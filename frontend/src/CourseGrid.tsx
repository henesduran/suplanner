import React, { useState } from "react";
import { memo } from 'react';

type Section = {
  code: string;
  section: string;
  crn?: string;
  schedule: {
    day_index: number;
    start_min: number;
    end_min: number;
    time: string;
    where?: string; 
    type?: string;  
  }[];
};

type Props = {
  sections: Section[];
};
const COURSE_COLORS = [
  "bg-indigo-600 border-indigo-700 hover:bg-indigo-700",
  "bg-emerald-600 border-emerald-700 hover:bg-emerald-700",
  "bg-sky-600 border-sky-700 hover:bg-sky-700",
  "bg-rose-600 border-rose-700 hover:bg-rose-700",
  "bg-amber-600 border-amber-700 hover:bg-amber-700",
  "bg-violet-600 border-violet-700 hover:bg-violet-700",
  "bg-teal-600 border-teal-700 hover:bg-teal-700",
];



const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const GRID_START_MIN = 520; 
const HOURS = [
  "08:40", "09:40", "10:40", "11:40", "12:40", 
  "13:40", "14:40", "15:40", "16:40", "17:40", "18:40"
];

function Coursegrid({ sections }: Props) {
  const [copiedCrn, setCopiedCrn] = useState<string | null>(null);

  const getGridRowStart = (min: number) => {
    return Math.floor((min - GRID_START_MIN) / 60) + 1;
  };

  const getGridRowSpan = (start: number, end: number) => {
    const durationMin = end - start;
    return Math.ceil(durationMin / 60);
  };
  const getColorByCourseCode = (code: string) => {
  let hash = 0;

  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 10) - hash);
  }

  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
};

  const handleCopyCRN = (crn:string|undefined, e:React.MouseEvent) => {
    e.stopPropagation();
    
    if(crn){
      navigator.clipboard.writeText(crn);
      setCopiedCrn(crn);
      setTimeout(() => setCopiedCrn(null), 700);
    }
  };

  // Build lane layout per day so that overlapping lectures are shown
  // side by side instead of one covering the other.
  const blocks: {
    key: string;
    section: Section;
    sch: Section["schedule"][number];
    i: number;
    rowStart: number;
    rowSpan: number;
    colStart: number;
  }[] = [];

  sections.forEach((section) => {
    section.schedule.forEach((sch, i) => {
      blocks.push({
        key: `${section.code}-${sch.day_index}-${i}`,
        section,
        sch,
        i,
        rowStart: getGridRowStart(sch.start_min),
        rowSpan: getGridRowSpan(sch.start_min, sch.end_min),
        colStart: sch.day_index + 2,
      });
    });
  });

  const positioned = new Map<string, { left: number; width: number; conflicts: boolean }>();
  const blocksByDay: Record<number, typeof blocks> = {};

  for (const block of blocks) {
    if (block.sch.day_index < 0) continue;
    if (!blocksByDay[block.sch.day_index]) blocksByDay[block.sch.day_index] = [];
    blocksByDay[block.sch.day_index].push(block);
  }

  for (const dayBlocks of Object.values(blocksByDay)) {
    dayBlocks.sort((a, b) => a.rowStart - b.rowStart || b.rowSpan - a.rowSpan);

    const laneEnds: number[] = [];
    const laneOf: Record<string, number> = {};

    for (const block of dayBlocks) {
      let lane = laneEnds.findIndex((end) => end <= block.rowStart);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneOf[block.key] = lane;
      laneEnds[lane] = block.rowStart + block.rowSpan;
    }

    const laneCount = laneEnds.length;
    const width = laneCount > 0 ? 100 / laneCount : 100;
    const conflictKeys = new Set<string>();

    for (let x = 0; x < dayBlocks.length; x++) {
      for (let y = x + 1; y < dayBlocks.length; y++) {
        const a = dayBlocks[x];
        const b = dayBlocks[y];
        const aEnd = a.rowStart + a.rowSpan;
        const bEnd = b.rowStart + b.rowSpan;
        if (a.rowStart < bEnd && b.rowStart < aEnd) {
          conflictKeys.add(a.key);
          conflictKeys.add(b.key);
        }
      }
    }

    for (const block of dayBlocks) {
      positioned.set(block.key, {
        left: laneOf[block.key] * width,
        width,
        conflicts: conflictKeys.has(block.key),
      });
    }
  }


  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-slate-900 p-4 transition-colors duration-300">
      
      <div className="grid grid-cols-[80px_repeat(5,1fr)] mb-2 sticky top-0 z-20 bg-gray-50 dark:bg-slate-900">
        <div className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 pt-2">Time</div>
        {DAYS.map((day) => (
          <div key={day} className="text-center font-bold text-gray-700 dark:text-gray-200 p-2 bg-blue-100 dark:bg-blue-900/30 rounded mx-1 transition-colors">
            {day}
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-[80px_repeat(5,1fr)]">
        
        {HOURS.map((hour, index) => (
          <React.Fragment key={hour}>
            <div 
              className="text-right pr-4 text-xs font-medium text-gray-700 dark:text-gray-400 flex items-center justify-end"
              style={{ gridRow: index + 1, height: '64px' }} 
            >
              {hour}
            </div>

            {DAYS.map((_, dayIndex) => (
              <div
                key={`${hour}-${dayIndex}`}
                className={`border-b border-r border-gray-200 dark:border-slate-800 h-16 transition-colors ${ 
                   index === 0 ? "border-t dark:border-t-slate-800" : "" 
                } ${dayIndex === 0 ? "border-l dark:border-l-slate-800" : ""}`}
                style={{ 
                    gridColumn: dayIndex + 2, 
                    gridRow: index + 1 
                }} 
              />
            ))}
          </React.Fragment>
        ))}

        {sections.map((section) =>
          section.schedule.map((sch, i) => {
            
            const rowStart = getGridRowStart(sch.start_min);
            const rowSpan = getGridRowSpan(sch.start_min, sch.end_min);
            const colStart = sch.day_index + 2;
            const colorClass = getColorByCourseCode(section.code);
            const isCopied = copiedCrn === section.crn;
            const pos = sch.day_index >= 0 ? positioned.get(`${section.code}-${sch.day_index}-${i}`) : null;

            return (
              <div
                key={`${section.code}-${sch.day_index}-${i}`}
                className="relative"
                style={{
                  gridColumn: colStart,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                }}
              >
                <div
                  onClick={(e)=>(handleCopyCRN(section.crn,e))}
                  className={`
                    ${colorClass}
                    absolute
                    inset-y-0
                    text-white
                    p-1 text-xs
                    border-2
                    rounded shadow-md
                    hover:brightness-110
                    cursor-pointer
                    active:scale-95
                    transition-all
                    z-10
                    flex flex-col
                    overflow-hidden
                  `}
                  style={pos ? { left: `${pos.left}%`, width: `${pos.width}%` } : { left: 0, right: 0 }}
                  title={section.crn ? `Click to copy CRN: ${section.crn}` : section.code}
                >
                  {isCopied && (
                    <div className="transition-all absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[0.5px] z-20 animate-in fade-in zoom-in duration-200">
                      <svg className="w-6 h-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-bold text-white drop-shadow-md text-[10px]">Copied CRN!</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-1">
                    <div className="font-bold break-words min-w-0 flex-1">
                      {section.code}
                    </div>
                    {pos?.conflicts && (
                      <span
                        className="text-[9px] font-bold bg-black/30 rounded-full px-1 leading-4 shrink-0"
                        title="This lecture conflicts with another selected lecture"
                      >
                        ⚠
                      </span>
                    )}
                    <div className="text-[9px] font-bold text-right break-words shrink-0 max-w-[48%] leading-tight">
                      {sch.time}
                    </div>
                  </div>

                  <div className="text-[10px] opacity-70 break-words leading-tight">
                    {section.section}
                  </div>

                  <div className="flex-1" />

                  {sch.where && (
                    <div className="text-[10px] font-bold break-words leading-tight">
                      {sch.where}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

      </div>
    </div>
  );
}

export default memo(Coursegrid);
