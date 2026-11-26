import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  analyzePipeline,
  bottleneckIndex,
  departureCv2,
  drawTime,
  improveStage,
  improvementGains,
  processCapacity,
  queueWait,
  seededRandom,
  simulatePipeline,
  stationCapacity,
  throughput,
  validatePipeline,
  type Pipeline,
} from '../lib/opsBottleneck';

/** The OPMGT 502 sandwich flow line: 1, 1.5 and 0.5 minutes, one worker each. */
const sandwich = (arrivalPerHour: number): Pipeline => ({
  arrivalRate: arrivalPerHour / 60,
  arrivalCv: 0,
  stages: [
    { name: 'Starter', servers: 1, serviceTime: 1, cv: 0 },
    { name: 'Stuffer', servers: 1, serviceTime: 1.5, cv: 0 },
    { name: 'Packer', servers: 1, serviceTime: 0.5, cv: 0 },
  ],
});

const presetById = (id: string) => {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
};

describe('process analysis (sandwich flow line)', () => {
  it('finds station capacities, the bottleneck and process capacity', () => {
    const p = sandwich(50);
    expect(p.stages.map((s) => stationCapacity(s) * 60)).toEqual([60, 40, 120]);
    expect(bottleneckIndex(p.stages)).toBe(1);
    expect(processCapacity(p.stages) * 60).toBeCloseTo(40, 10);
  });

  it('caps throughput at the bottleneck when demand exceeds capacity', () => {
    const a = analyzePipeline(sandwich(50));
    expect(a.throughput * 60).toBeCloseTo(40, 10);
    expect(a.overloaded).toBe(true);
    expect(a.demandConstrained).toBe(false);
    expect(a.queueGrowthRate * 60).toBeCloseTo(10, 10);
    expect(a.cycleTime).toBeCloseTo(1.5, 10);
    expect(a.leadTime).toBe(Number.POSITIVE_INFINITY);
  });

  it('computes the correct utilizations at 40 per hour of demand', () => {
    const a = analyzePipeline(sandwich(40));
    const u = a.stages.map((s) => s.utilization);
    expect(u[0]).toBeCloseTo(2 / 3, 10);
    expect(u[1]).toBeCloseTo(1, 10);
    expect(u[2]).toBeCloseTo(1 / 3, 10);
  });

  it('is demand-constrained below capacity, with a 3-minute minimum lead time and Little’s Law WIP', () => {
    const a = analyzePipeline(sandwich(30));
    expect(a.demandConstrained).toBe(true);
    expect(a.throughput * 60).toBeCloseTo(30, 10);
    expect(a.minLeadTime).toBe(3);
    // No variability means no waiting, so lead time equals the minimum.
    expect(a.leadTime).toBeCloseTo(3, 10);
    expect(a.wip).toBeCloseTo(a.throughput * a.leadTime, 10);
    expect(a.wip).toBeCloseTo(1.5, 10);
  });
});

describe('non-bottleneck optimization gives zero gain', () => {
  it('leaves throughput unchanged when any non-bottleneck stage doubles', () => {
    for (const preset of PRESETS) {
      const gains = improvementGains(preset.pipeline, 2);
      for (const g of gains.filter((x) => !x.isBottleneck)) {
        expect(g.gain, `${preset.id}: ${g.name}`).toBe(0);
      }
    }
  });

  it('raises throughput only when the bottleneck improves and capacity, not demand, binds', () => {
    const gains = improvementGains(sandwich(50), 2);
    const b = gains.find((g) => g.isBottleneck);
    expect(b?.name).toBe('Stuffer');
    // Doubling the stuffer lifts the line from 40 to the next limit or demand: 50 an hour.
    expect((b?.gain ?? 0) * 60).toBeCloseTo(10, 10);
    const packer = gains.find((g) => g.name === 'Packer');
    expect(packer?.gain).toBe(0);
  });

  it('cuts lead time most when the bottleneck gets the capacity in a demand-constrained line', () => {
    const gains = improvementGains(presetById('robot-line').pipeline, 2);
    const b = gains.find((g) => g.isBottleneck);
    const others = gains.filter((g) => !g.isBottleneck);
    expect(b?.gain).toBe(0);
    const cut = (g: { leadTimeBefore: number; leadTimeAfter: number }) => g.leadTimeBefore - g.leadTimeAfter;
    for (const o of others) expect(cut(b ?? o)).toBeGreaterThan(cut(o));
  });

  it('moves the bottleneck after it is elevated', () => {
    const elevated = improveStage(sandwich(80), 1, 2);
    expect(bottleneckIndex(elevated.stages)).toBe(0);
    expect(throughput(elevated) * 60).toBeCloseTo(60, 10);
  });

  it('shows the same zero gain in simulation when a non-bottleneck is sped up', () => {
    const base = presetById('llm-inference').pipeline;
    const faster = improveStage(base, 0, 3);
    const a = simulatePipeline(base, 400, 60, 7);
    const b = simulatePipeline(faster, 400, 60, 7);
    expect(Math.abs(a.observedThroughput - b.observedThroughput) / a.observedThroughput).toBeLessThan(0.02);
  });
});

describe('queueing approximations', () => {
  it('matches the M/M/1 waiting time for one server with random arrivals and service', () => {
    // Arrival every 6 minutes, 5-minute service: u = 0.8333 and Wq = p × u / (1 − u) = 25.
    expect(queueWait(5, 1, 5 / 6, 1, 1)).toBeCloseTo(25, 6);
  });

  it('explodes as utilization approaches 100% and is zero with no variability', () => {
    const w80 = queueWait(1, 1, 0.8, 1, 1);
    const w95 = queueWait(1, 1, 0.95, 1, 1);
    expect(w95 / w80).toBeCloseTo(19 / 4, 6);
    expect(queueWait(1, 1, 1, 1, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(queueWait(1, 1, 0.9, 0, 0)).toBe(0);
  });

  it('cuts waiting by pooling servers at the same utilization', () => {
    const separate = queueWait(10, 1, 0.9, 1, 1);
    const pooled = queueWait(10, 4, 0.9, 1, 1);
    expect(pooled).toBeLessThan(separate / 3);
  });

  it('passes arrival variability through a lightly loaded station and service variability through a busy one', () => {
    expect(departureCv2(2, 0.25, 0.05, 1)).toBeCloseTo(2, 1);
    expect(departureCv2(2, 0.25, 0.99, 1)).toBeCloseTo(0.27, 1);
  });
});

describe('presets', () => {
  it('covers factory or robotics lines and AI inference or ML labeling pipelines', () => {
    expect(PRESETS.some((p) => p.domain === 'factory')).toBe(true);
    expect(PRESETS.filter((p) => p.domain === 'ai').map((p) => p.id).sort()).toEqual(['llm-inference', 'ml-labeling']);
    for (const p of PRESETS) expect(validatePipeline(p.pipeline), p.id).toEqual({ ok: true });
  });

  it('puts the bottleneck where each preset says it is', () => {
    const name = (id: string) => {
      const p = presetById(id).pipeline;
      return p.stages[bottleneckIndex(p.stages)]?.name;
    };
    expect(name('robot-line')).toBe('Vision calibration');
    expect(name('sandwich-line')).toBe('Stuffer');
    expect(name('llm-inference')).toBe('GPU inference');
    expect(name('ml-labeling')).toBe('Expert review');
  });

  it('runs the stable presets at 90-94% bottleneck utilization so a queue is visible but bounded', () => {
    for (const id of ['robot-line', 'llm-inference', 'ml-labeling']) {
      const a = analyzePipeline(presetById(id).pipeline);
      const u = a.stages[a.bottleneckIndex]?.utilization ?? 0;
      expect(u, id).toBeGreaterThan(0.899);
      expect(u, id).toBeLessThan(0.95);
      expect(Number.isFinite(a.leadTime), id).toBe(true);
    }
  });

  it('rejects broken inputs', () => {
    const p = presetById('robot-line').pipeline;
    expect(validatePipeline({ ...p, arrivalRate: 0 }).ok).toBe(false);
    expect(validatePipeline({ ...p, stages: p.stages.slice(0, 1) }).ok).toBe(false);
    expect(validatePipeline({ ...p, stages: p.stages.map((s, i) => (i === 0 ? { ...s, servers: 1.5 } : s)) }).ok).toBe(false);
    expect(validatePipeline({ ...p, stages: p.stages.map((s, i) => (i === 0 ? { ...s, serviceTime: -1 } : s)) }).ok).toBe(false);
  });
});

describe('discrete-event simulation', () => {
  it('is reproducible for the same seed', () => {
    const p = presetById('robot-line').pipeline;
    expect(simulatePipeline(p, 400, 40, 11)).toEqual(simulatePipeline(p, 400, 40, 11));
  });

  it('draws lognormal times with the requested mean and the exact mean when CV is 0', () => {
    const rand = seededRandom(3);
    const n = 20_000;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += drawTime(2, 0.8, rand);
    expect(sum / n).toBeCloseTo(2, 1);
    expect(drawTime(2, 0, rand)).toBe(2);
  });

  it('delivers throughput near the analytic value and satisfies Little’s Law', () => {
    const p = presetById('llm-inference').pipeline;
    const a = analyzePipeline(p);
    const sim = simulatePipeline(p, 400, 100, 5);
    expect(Math.abs(sim.observedThroughput - a.throughput) / a.throughput).toBeLessThan(0.03);
    // Time-average WIP ≈ throughput × lead time over a long horizon.
    expect(Math.abs(sim.observedWip - sim.observedThroughput * sim.observedLeadTime) / sim.observedWip).toBeLessThan(0.05);
  });

  it('builds the biggest queue in front of the bottleneck', () => {
    for (const id of ['robot-line', 'llm-inference', 'ml-labeling', 'sandwich-line']) {
      const preset = presetById(id);
      const sim = simulatePipeline(preset.pipeline, id === 'llm-inference' ? 300 : 400, 80, 9);
      const b = bottleneckIndex(preset.pipeline.stages);
      const maxQ = Math.max(...sim.maxQueues);
      expect(sim.maxQueues[b], id).toBe(maxQ);
    }
  });

  it('grows the bottleneck queue roughly linearly when demand exceeds capacity', () => {
    const sim = simulatePipeline(sandwich(50), 600, 60, 1);
    const end = sim.samples[sim.samples.length - 1]?.queues[1] ?? 0;
    // 10 extra customers an hour for 10 hours ≈ 100 waiting at the stuffer.
    expect(end).toBeGreaterThan(80);
    expect(end).toBeLessThan(110);
    expect(sim.observedThroughput * 60).toBeCloseTo(40, 0);
  });
});
