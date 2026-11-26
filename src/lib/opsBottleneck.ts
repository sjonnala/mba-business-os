/**
 * Operations bottleneck and Little's Law math for Lab #4.
 *
 * A pipeline is a line of stages in series. Each stage has m parallel resources, a mean service
 * time p per job and a coefficient of variation (CV) of that service time. Jobs arrive at rate λ
 * with an inter-arrival CV. Time units are whatever the preset says (minutes, seconds, hours);
 * every rate is "jobs per time unit".
 *
 * Analytic results follow the OPMGT 502 process-analysis toolkit:
 *   capacity_i = m_i / p_i, bottleneck = argmin capacity, Th = min(λ, min capacity),
 *   u_i = Th / capacity_i, cycle time = 1 / Th, WIP = Th × lead time (Little's Law),
 *   Wq ≈ (p/m) × u^(√(2(m+1)) − 1) / (1 − u) × (Ca² + Cs²) / 2 (Sakasegawa / Kingman).
 * The discrete-event simulation draws lognormal times from a seeded generator so results are
 * reproducible in tests and in the UI.
 */

export interface Stage {
  name: string;
  /** Parallel resources at the stage: workers, machines, GPUs, reviewers. */
  servers: number;
  /** Mean service time per job, in the pipeline's time unit. */
  serviceTime: number;
  /** Coefficient of variation of the service time (0 = perfectly regular). */
  cv: number;
}

export interface Pipeline {
  /** Jobs arriving per time unit. */
  arrivalRate: number;
  /** Coefficient of variation of inter-arrival times (1 ≈ random arrivals). */
  arrivalCv: number;
  stages: Stage[];
}

export interface PipelinePreset {
  id: string;
  label: string;
  domain: 'factory' | 'ai';
  jobNoun: string;
  timeUnit: string;
  blurb: string;
  pipeline: Pipeline;
}

export interface StageResult {
  name: string;
  capacity: number;
  utilization: number;
  /** Squared CV of arrivals into this stage (after upstream smoothing or amplification). */
  arrivalCv2: number;
  /** Expected queue wait in steady state; Infinity when the stage is overloaded. */
  waitTime: number;
  /** Expected jobs waiting in the queue (Little's Law on the queue alone). */
  queueLength: number;
  isBottleneck: boolean;
}

export interface PipelineAnalysis {
  stages: StageResult[];
  bottleneckIndex: number;
  processCapacity: number;
  throughput: number;
  /** True when demand, not capacity, limits throughput. */
  demandConstrained: boolean;
  /** True when arrivals exceed process capacity, so the queue in front of the bottleneck grows without limit. */
  overloaded: boolean;
  /** Jobs per time unit added to the bottleneck queue when overloaded, otherwise 0. */
  queueGrowthRate: number;
  cycleTime: number;
  /** Sum of service times: the lead time with no waiting at all. */
  minLeadTime: number;
  /** Service plus expected waiting; Infinity when any stage is at or above 100% utilization. */
  leadTime: number;
  /** Little's Law: average jobs in the system = throughput × lead time. */
  wip: number;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validatePipeline(p: Pipeline): ValidationResult {
  if (!(p.arrivalRate > 0)) return { ok: false, reason: 'Arrival rate must be above zero.' };
  if (!(p.arrivalCv >= 0) || p.arrivalCv > 3) return { ok: false, reason: 'Arrival variability (CV) must be between 0 and 3.' };
  if (p.stages.length < 2 || p.stages.length > 6) return { ok: false, reason: 'Use between 2 and 6 stages.' };
  for (const s of p.stages) {
    if (!Number.isInteger(s.servers) || s.servers < 1 || s.servers > 200) {
      return { ok: false, reason: `${s.name}: resources must be a whole number from 1 to 200.` };
    }
    if (!(s.serviceTime > 0)) return { ok: false, reason: `${s.name}: service time must be above zero.` };
    if (!(s.cv >= 0) || s.cv > 3) return { ok: false, reason: `${s.name}: variability (CV) must be between 0 and 3.` };
  }
  return { ok: true };
}

export function stationCapacity(s: Stage): number {
  return s.servers / s.serviceTime;
}

/** Index of the lowest-capacity stage; ties go to the earliest stage. */
export function bottleneckIndex(stages: readonly Stage[]): number {
  let best = 0;
  stages.forEach((s, i) => {
    if (stationCapacity(s) < stationCapacity(stages[best] ?? s) - 1e-12) best = i;
  });
  return best;
}

export function processCapacity(stages: readonly Stage[]): number {
  return Math.min(...stages.map(stationCapacity));
}

export function throughput(p: Pipeline): number {
  return Math.min(p.arrivalRate, processCapacity(p.stages));
}

/**
 * Sakasegawa's approximation of the expected queue wait at an m-server station.
 * Returns Infinity at or above 100% utilization.
 */
export function queueWait(serviceTime: number, servers: number, utilization: number, arrivalCv2: number, serviceCv2: number): number {
  if (utilization >= 1) return Number.POSITIVE_INFINITY;
  if (utilization <= 0) return 0;
  const exponent = Math.sqrt(2 * (servers + 1)) - 1;
  return (serviceTime / servers) * (utilization ** exponent / (1 - utilization)) * ((arrivalCv2 + serviceCv2) / 2);
}

/** Squared CV of departures from a station (linking equation), which becomes the next stage's arrival CV². */
export function departureCv2(arrivalCv2: number, serviceCv2: number, utilization: number, servers: number): number {
  const u = Math.min(utilization, 1);
  return 1 + (1 - u * u) * (arrivalCv2 - 1) + ((u * u) / Math.sqrt(servers)) * (serviceCv2 - 1);
}

export function analyzePipeline(p: Pipeline): PipelineAnalysis {
  const bIdx = bottleneckIndex(p.stages);
  const cap = processCapacity(p.stages);
  const overloaded = p.arrivalRate > cap + 1e-12;
  const th = Math.min(p.arrivalRate, cap);

  let ca2 = p.arrivalCv * p.arrivalCv;
  const stages: StageResult[] = p.stages.map((s, i) => {
    const capacity = stationCapacity(s);
    // Offered load: stages up to the bottleneck see the full arrival stream; when overloaded
    // the bottleneck itself sits at 100% and downstream stages see the bottleneck's output.
    const offered = i <= bIdx ? p.arrivalRate : th;
    const utilization = offered / capacity;
    const cs2 = s.cv * s.cv;
    const waitTime = queueWait(s.serviceTime, s.servers, utilization, ca2, cs2);
    const result: StageResult = {
      name: s.name,
      capacity,
      utilization,
      arrivalCv2: ca2,
      waitTime,
      queueLength: Number.isFinite(waitTime) ? offered * waitTime : Number.POSITIVE_INFINITY,
      isBottleneck: i === bIdx,
    };
    ca2 = departureCv2(ca2, cs2, utilization, s.servers);
    return result;
  });

  const minLeadTime = p.stages.reduce((sum, s) => sum + s.serviceTime, 0);
  const totalWait = stages.reduce((sum, s) => sum + s.waitTime, 0);
  const leadTime = minLeadTime + totalWait;
  return {
    stages,
    bottleneckIndex: bIdx,
    processCapacity: cap,
    throughput: th,
    demandConstrained: p.arrivalRate < cap - 1e-12,
    overloaded,
    queueGrowthRate: overloaded ? p.arrivalRate - cap : 0,
    cycleTime: 1 / th,
    minLeadTime,
    leadTime,
    wip: Number.isFinite(leadTime) ? th * leadTime : Number.POSITIVE_INFINITY,
  };
}

/** Returns a copy of the pipeline with one stage's capacity multiplied by `factor` (by cutting its service time). */
export function improveStage(p: Pipeline, index: number, factor: number): Pipeline {
  return {
    ...p,
    stages: p.stages.map((s, i) => (i === index ? { ...s, serviceTime: s.serviceTime / factor } : s)),
  };
}

export interface ImprovementGain {
  stageIndex: number;
  name: string;
  isBottleneck: boolean;
  throughputBefore: number;
  throughputAfter: number;
  /** Change in throughput, in jobs per time unit. */
  gain: number;
  leadTimeBefore: number;
  leadTimeAfter: number;
}

/** What happens to throughput if each stage, in turn, gets `factor` times its capacity. */
export function improvementGains(p: Pipeline, factor = 2): ImprovementGain[] {
  const before = throughput(p);
  const leadBefore = analyzePipeline(p).leadTime;
  const bIdx = bottleneckIndex(p.stages);
  return p.stages.map((s, i) => {
    const improved = improveStage(p, i, factor);
    const after = throughput(improved);
    const gain = after - before;
    return {
      stageIndex: i,
      name: s.name,
      isBottleneck: i === bIdx,
      throughputBefore: before,
      throughputAfter: after,
      gain: Math.abs(gain) < 1e-9 ? 0 : gain,
      leadTimeBefore: leadBefore,
      leadTimeAfter: analyzePipeline(improved).leadTime,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Discrete-event simulation
// ---------------------------------------------------------------------------------------------

/** Mulberry32: a tiny seeded PRNG so simulations are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a positive time with the given mean and CV from a lognormal distribution (CV 0 = the mean exactly). */
export function drawTime(mean: number, cv: number, rand: () => number): number {
  if (cv <= 0) return mean;
  const sigma2 = Math.log(1 + cv * cv);
  const mu = Math.log(mean) - sigma2 / 2;
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + Math.sqrt(sigma2) * z);
}

export interface SimSample {
  time: number;
  /** Jobs waiting (not yet in service) in front of each stage. */
  queues: number[];
  /** Jobs anywhere in the system: waiting or in service. */
  wip: number;
}

export interface SimulationResult {
  horizon: number;
  samples: SimSample[];
  arrived: number;
  completed: number;
  /** Completions per time unit over the horizon. */
  observedThroughput: number;
  /** Average time in system of jobs that finished within the horizon. */
  observedLeadTime: number;
  /** Time-averaged number of jobs in the system over the horizon. */
  observedWip: number;
  /** Largest queue seen at each stage. */
  maxQueues: number[];
}

interface JobTimes {
  arrive: number;
  /** start[i] and finish[i] for each stage. */
  start: number[];
  finish: number[];
}

/**
 * Simulates the pipeline over [0, horizon] with FIFO queues and unlimited buffers.
 * Jobs are dispatched at each stage in the order they become ready, to the earliest free resource.
 */
export function simulatePipeline(p: Pipeline, horizon: number, sampleCount = 120, seed = 42): SimulationResult {
  const rand = seededRandom(seed);
  const jobs: JobTimes[] = [];
  let t = 0;
  const meanGap = 1 / p.arrivalRate;
  // Cap the job count so a pathological input cannot freeze the browser.
  const maxJobs = 20_000;
  for (;;) {
    t += drawTime(meanGap, p.arrivalCv, rand);
    if (t > horizon || jobs.length >= maxJobs) break;
    jobs.push({ arrive: t, start: [], finish: [] });
  }

  p.stages.forEach((stage, si) => {
    const free = new Array<number>(stage.servers).fill(0);
    const order = jobs
      .map((job, ji) => ({ ji, ready: si === 0 ? job.arrive : (job.finish[si - 1] ?? job.arrive) }))
      .sort((a, b) => a.ready - b.ready || a.ji - b.ji);
    for (const { ji, ready } of order) {
      let k = 0;
      for (let s = 1; s < free.length; s += 1) if ((free[s] ?? 0) < (free[k] ?? 0)) k = s;
      const start = Math.max(ready, free[k] ?? 0);
      const finish = start + drawTime(stage.serviceTime, stage.cv, rand);
      free[k] = finish;
      const job = jobs[ji];
      if (job) {
        job.start[si] = start;
        job.finish[si] = finish;
      }
    }
  });

  const last = p.stages.length - 1;
  const samples: SimSample[] = [];
  const maxQueues = new Array<number>(p.stages.length).fill(0);
  for (let k = 0; k <= sampleCount; k += 1) {
    const time = (horizon * k) / sampleCount;
    const queues = new Array<number>(p.stages.length).fill(0);
    let wip = 0;
    for (const job of jobs) {
      if (job.arrive > time) continue;
      const done = job.finish[last] ?? Number.POSITIVE_INFINITY;
      if (done <= time) continue;
      wip += 1;
      for (let si = 0; si <= last; si += 1) {
        const ready = si === 0 ? job.arrive : (job.finish[si - 1] ?? Number.POSITIVE_INFINITY);
        const start = job.start[si] ?? Number.POSITIVE_INFINITY;
        if (ready <= time && time < start) {
          queues[si] = (queues[si] ?? 0) + 1;
          break;
        }
      }
    }
    queues.forEach((q, si) => {
      if (q > (maxQueues[si] ?? 0)) maxQueues[si] = q;
    });
    samples.push({ time, queues, wip });
  }

  const finished = jobs.filter((j) => (j.finish[last] ?? Number.POSITIVE_INFINITY) <= horizon);
  const observedLeadTime =
    finished.length > 0 ? finished.reduce((sum, j) => sum + ((j.finish[last] ?? 0) - j.arrive), 0) / finished.length : 0;
  // Exact time-average of jobs in system over [0, horizon]: each job contributes its time inside the window.
  const jobTime = jobs.reduce((sum, j) => sum + Math.min(j.finish[last] ?? horizon, horizon) - j.arrive, 0);

  return {
    horizon,
    samples,
    arrived: jobs.length,
    completed: finished.length,
    observedThroughput: finished.length / horizon,
    observedLeadTime,
    observedWip: jobTime / horizon,
    maxQueues,
  };
}

// ---------------------------------------------------------------------------------------------
// Presets: factory and robotics lines, AI inference and ML labeling pipelines
// ---------------------------------------------------------------------------------------------

export const PRESETS: readonly PipelinePreset[] = [
  {
    id: 'robot-line',
    label: 'Robot assembly line',
    domain: 'factory',
    jobNoun: 'robots',
    timeUnit: 'hour',
    blurb: 'An illustrative field-robot assembly line. Vision calibration is the slowest station, so it sets the pace for the whole line.',
    pipeline: {
      arrivalRate: 0.72,
      arrivalCv: 0.5,
      stages: [
        { name: 'Frame and chassis', servers: 1, serviceTime: 0.9, cv: 0.4 },
        { name: 'Laser module install', servers: 2, serviceTime: 2, cv: 0.5 },
        { name: 'Vision calibration', servers: 1, serviceTime: 1.25, cv: 0.6 },
        { name: 'Field test', servers: 2, serviceTime: 1.6, cv: 0.5 },
      ],
    },
  },
  {
    id: 'sandwich-line',
    label: 'Three-station sandwich line',
    domain: 'factory',
    jobNoun: 'customers',
    timeUnit: 'minute',
    blurb: 'The OPMGT 502 flow-line example: 1, 1.5 and 0.5 minutes per station with demand of 50 an hour. The stuffer caps the line at 40 an hour, so the queue grows.',
    pipeline: {
      arrivalRate: 50 / 60,
      arrivalCv: 1,
      stages: [
        { name: 'Starter', servers: 1, serviceTime: 1, cv: 0.3 },
        { name: 'Stuffer', servers: 1, serviceTime: 1.5, cv: 0.3 },
        { name: 'Packer', servers: 1, serviceTime: 0.5, cv: 0.3 },
      ],
    },
  },
  {
    id: 'llm-inference',
    label: 'LLM inference service',
    domain: 'ai',
    jobNoun: 'requests',
    timeUnit: 'second',
    blurb: 'An illustrative serving stack. GPU inference is the bottleneck; faster tokenizing or filtering on CPUs adds no requests per second.',
    pipeline: {
      arrivalRate: 40,
      arrivalCv: 1,
      stages: [
        { name: 'Tokenize and route', servers: 4, serviceTime: 0.05, cv: 0.3 },
        { name: 'GPU inference', servers: 4, serviceTime: 0.09, cv: 0.8 },
        { name: 'Safety filter', servers: 2, serviceTime: 0.03, cv: 0.5 },
        { name: 'Stream and log', servers: 2, serviceTime: 0.02, cv: 0.3 },
      ],
    },
  },
  {
    id: 'ml-labeling',
    label: 'ML data labeling pipeline',
    domain: 'ai',
    jobNoun: 'images',
    timeUnit: 'hour',
    blurb: 'An illustrative labeling flow. Ten labelers outpace two expert reviewers, so review sets throughput and the backlog builds in front of it.',
    pipeline: {
      arrivalRate: 75,
      arrivalCv: 0.8,
      stages: [
        { name: 'Model pre-label', servers: 1, serviceTime: 0.004, cv: 0.2 },
        { name: 'Human labeling', servers: 10, serviceTime: 0.1, cv: 0.7 },
        { name: 'Expert review', servers: 2, serviceTime: 0.025, cv: 0.9 },
        { name: 'Dataset export', servers: 1, serviceTime: 0.008, cv: 0.2 },
      ],
    },
  },
];
