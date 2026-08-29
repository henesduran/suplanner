import { runScheduler } from "../logic/scheduler";

self.onmessage = (e: MessageEvent) => {
  const { selected, courses, constraints, pinnedSections, allowConflict } = e.data;

  try {
    const result = runScheduler(selected, courses, constraints, pinnedSections, allowConflict);

    if (constraints.compact && result.length > 0) {
      result.sort((programA: any, programB: any) => calculateGapScore(programA) - calculateGapScore(programB));
    }
    
    self.postMessage({ status: "success", schedules: result });
  } catch (error) {
    self.postMessage({ status: "error", error });
  }
};

const calculateGapScore = (schedule: any[]) => {
  let totalGapMinutes = 0;
  const daysMap: Record<number, { start: number; end: number }[]> = {};

  (schedule || []).forEach((section: any) => {
    (section.schedule || []).forEach((slot: any) => {
      if (!slot || slot.day_index === undefined || slot.day_index === -1) return;
      const day = Number(slot.day_index);
      const start = Number(slot.start_min);
      const end = Number(slot.end_min);
      if (Number.isNaN(start) || Number.isNaN(end)) return;

      if (!daysMap[day]) daysMap[day] = [];
      daysMap[day].push({ start, end });
    });
  });

  Object.values(daysMap).forEach((dayClasses) => {
    dayClasses.sort((a, b) => a.start - b.start);
    for (let i = 0; i < dayClasses.length - 1; i++) {
      const gap = dayClasses[i + 1].start - dayClasses[i].end;
      if (gap > 15) totalGapMinutes += gap;
    }
  });

  return totalGapMinutes;
};
