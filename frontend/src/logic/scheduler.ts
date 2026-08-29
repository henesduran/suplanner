
// constants
const BIT_RESOLUTION = 10;
const SLOTS_PER_DAY = Math.floor((24 * 60) / BIT_RESOLUTION);

// Types
export interface TimeSlot {
  day_index: number;
  start_min: number;
  end_min: number;
}

export interface Section {
  section: string;
  crn?: string;
  schedule: TimeSlot[];
  [key: string]: any; 
}

export interface CourseData {
  name: string;
  sections: Section[];
  corequisites?: string[];
}

export interface GroupedCourses {
  [code: string]: CourseData;
}

export interface SchedulerConstraints {
  no840: boolean;
  day_offs: number[];
  lunchBreak: boolean;
  compact?: boolean;
}

function calculateSectionBitmask(schedule: TimeSlot[]): bigint {
  let mask = 0n;
  for (const slot of schedule) {
    if (slot.day_index === -1 || slot.start_min === undefined) continue;

    const startMin = Number(slot.start_min);
    const endMin = Number(slot.end_min);
    const dayIndex = Number(slot.day_index);

    const dayOffset = dayIndex * SLOTS_PER_DAY;
    const startSlot = Math.floor(startMin / BIT_RESOLUTION);
    const endSlot = Math.floor(endMin / BIT_RESOLUTION);

    for (let i = startSlot; i < endSlot; i++) {
      const globalPosition = BigInt(dayOffset + i);
      mask |= (1n << globalPosition);
    }
  }
  return mask;
}

// Constraint Mask
function calculateConstraintMask(constraints:SchedulerConstraints): bigint {
  let constraintMask = 0n;

  if (constraints.no840) {
    const startMin = 8 * 60 + 40;
    const endMin = 9 * 60 + 30;
    const startSlot = Math.floor(startMin / BIT_RESOLUTION);
    const endSlot = Math.floor(endMin / BIT_RESOLUTION);

    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const dayOffset = dayIndex * SLOTS_PER_DAY;
      for (let i = startSlot; i < endSlot; i++) {
        constraintMask |= (1n << BigInt(dayOffset + i));
      }
    }
  }

  if (constraints.lunchBreak) {
    const startMin = 12 * 60 + 40;
    const endMin = 13 * 60 + 30;
    
    const startSlot = Math.floor(startMin / BIT_RESOLUTION);
    const endSlot = Math.floor(endMin / BIT_RESOLUTION);

    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const dayOffset = dayIndex * SLOTS_PER_DAY;
      for (let i = startSlot; i < endSlot; i++) {
        constraintMask |= (1n << BigInt(dayOffset + i));
      }
    }
  }

  if (constraints.day_offs && constraints.day_offs.length > 0) {
    for (const dayIndex of constraints.day_offs) {
        if (dayIndex < 0 || dayIndex > 6) continue;
        
        const dayOffset = dayIndex * SLOTS_PER_DAY;
        for (let i = 0; i < SLOTS_PER_DAY; i++) {
            constraintMask |= (1n << BigInt(dayOffset + i));
        }
    }
  }

  return constraintMask;
}

// Main algorihm
function solveScheduleRecursive(
  selectedCodes: string[],
  allCourses: GroupedCourses,
  constraints: SchedulerConstraints,
  pinnedSections: Record<string, string> = {},
  allowConflict: Record<string, string[]> = {},
  maxResults = 5000
): any[][] {
  const initialMask = calculateConstraintMask(constraints);
  const targetCourses: { code: string; sections: { data: Section; mask: bigint }[] }[] = [];

  // A lecture and its recitation/lab sections form one family. A conflict
  // allowance between two courses therefore covers every lecture/lab/recitation
  // pair inside both families.
  const familyCache = new Map<string, string[]>();
  const getFamily = (code: string): string[] => {
    const cached = familyCache.get(code);
    if (cached) return cached;

    const family: string[] = [];
    const seen = new Set<string>([code]);
    const stack = [code];

    while (stack.length > 0) {
      const cur = stack.pop()!;
      family.push(cur);
      const coreqs = allCourses[cur]?.corequisites ?? [];
      for (const req of coreqs) {
        if (!seen.has(req)) {
          seen.add(req);
          stack.push(req);
        }
      }
    }

    familyCache.set(code, family);
    return family;
  };

  const allowedConflictPairs = new Set<string>();
  for (const [code, targets] of Object.entries(allowConflict)) {
    for (const target of targets) {
      for (const a of getFamily(code)) {
        for (const b of getFamily(target)) {
          if (a === b) continue;
          allowedConflictPairs.add(a < b ? `${a}||${b}` : `${b}||${a}`);
        }
      }
    }
  }

  const allowsConflict = (a: string, b: string): boolean => {
    const key = a < b ? `${a}||${b}` : `${b}||${a}`;
    return allowedConflictPairs.has(key);
  };

  // Data manipulation
  for (const code of selectedCodes) {
    if (!allCourses[code]) continue;
    
    const courseData = allCourses[code];
    const pinnedCRN = pinnedSections[code] || pinnedSections[courseData.name];

    const preparedSections = [];
    for (const section of allCourses[code].sections) {
      if (section.section === "X") continue;

      if (pinnedCRN && section.crn !== pinnedCRN) {
          continue; 
      }
      
      const mask = calculateSectionBitmask(section.schedule);
      if ((mask & initialMask) !== 0n) continue; //? eliminate early

      preparedSections.push({ data: section, mask });
    }

    if (preparedSections.length === 0) return []; 
    
    targetCourses.push({ code, sections: preparedSections });
  }

  // Fail fast
  targetCourses.sort((a, b) => a.sections.length - b.sections.length);

  const validSchedules: any[][] = [];

  function backtrack(
    courseIdx: number,
    currentPath: { code: string; data: Section; mask: bigint }[],
    combinedMask: bigint
  ): boolean {
    if (courseIdx === targetCourses.length) {
      validSchedules.push(currentPath.map((p) => p.data));
      return validSchedules.length >= maxResults;
    }

    const currentCourse = targetCourses[courseIdx];
    for (const sectionObj of currentCourse.sections) {
      const overlaps = (combinedMask & sectionObj.mask) !== 0n;
      if (overlaps) {
        const pairAllowed = currentPath.some(
          (placed) =>
            (placed.mask & sectionObj.mask) !== 0n &&
            allowsConflict(currentCourse.code, placed.code)
        );
        if (!pairAllowed) continue;
      }

      currentPath.push({
        code: currentCourse.code,
        data: sectionObj.data,
        mask: sectionObj.mask,
      });
      const newMask = combinedMask | sectionObj.mask;

      if (backtrack(courseIdx + 1, currentPath, newMask)) return true;
      
      currentPath.pop();
    }
    return false;
  }

  if (targetCourses.length > 0) {
    backtrack(0, [], initialMask);
  }

  return validSchedules;
}

// Visual signature
function groupSchedulesByVisuals(schedules: any[][]): any[][] {
  const groupedBySig: { [key: string]: any[][] } = {};

  for (const sched of schedules) {
    const times: string[] = [];
    for (const section of sched) {
      for (const slot of section.schedule) {
        if (slot.day_index !== -1) {
          times.push(`${slot.day_index}-${slot.start_min}-${slot.end_min}`);
        }
      }
    }
    times.sort();
    const signature = times.join("|");

    if (!groupedBySig[signature]) groupedBySig[signature] = [];
    groupedBySig[signature].push(sched);
  }

  const finalResult: any[][] = [];
  const groups = Object.values(groupedBySig);
  
  if (groups.length > 0) {
    const maxLen = Math.max(...groups.map(g => g.length));
    for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (i < group.length) finalResult.push(group[i]);
      }
    }
  }
  
  return finalResult.slice(0, 100);
}

// Worker Wrapper
export function runScheduler(
  selectedCodes: string[],
  allCourses: GroupedCourses,
  constraints: SchedulerConstraints,
  pinnedSections: Record<string, string> = {},
  allowConflict: Record<string, string[]> = {}
) {
    const rawSchedules = solveScheduleRecursive(selectedCodes, allCourses, constraints, pinnedSections, allowConflict);
    return groupSchedulesByVisuals(rawSchedules);
}
