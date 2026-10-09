import type { DesignDocument } from "./design";

const monthNames = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthGrid(month: number) {
  const firstDay = new Date(Date.UTC(2027, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(2027, month + 1, 0)).getUTCDate();
  const cells = Array(firstDay).fill("  ");
  cells.push(
    ...Array.from({ length: daysInMonth }, (_, day) =>
      String(day + 1).padStart(2, " "),
    ),
  );
  while (cells.length % 7) cells.push("  ");
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7)
    weeks.push(cells.slice(i, i + 7).join(" "));
  return `${weekdays.join(" ")}\n${weeks.join("\n")}`;
}

export const calendar2027Document = {
  id: "design-2027-calendar-decorative",
  name: "2027 Decorative Calendar",
  canvasW: 1200,
  canvasH: 900,
  bg: {
    type: "gradient",
    color: "#fffaf1",
    gradState: {
      type: "linear",
      color1: "#fffaf1",
      color2: "#e9e4ff",
      angle: 135,
    },
  },
  gradState: {
    type: "linear",
    color1: "#fffaf1",
    color2: "#e9e4ff",
    angle: 135,
  },
  elements: [
    {
      id: "calendar-kicker",
      type: "text",
      x: 70,
      y: 35,
      w: 340,
      h: 20,
      rotation: 0,
      text: "A YEAR TO REMEMBER",
      fontFamily: "Montserrat",
      fontSize: 13,
      color: "#8b6f89",
      bold: true,
      letterSpacing: 2,
      align: "left",
      lineHeight: 1.2,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
    },
    {
      id: "calendar-year",
      type: "text",
      x: 70,
      y: 55,
      w: 470,
      h: 104,
      rotation: 0,
      text: "2027",
      fontFamily: "Bungee",
      fontSize: 88,
      color: "#3d3652",
      bold: true,
      align: "left",
      lineHeight: 1,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
    },
    {
      id: "calendar-subtitle",
      type: "text",
      x: 650,
      y: 76,
      w: 480,
      h: 72,
      rotation: 0,
      text: "Twelve little chapters\nwaiting to be written.",
      fontFamily: "Pacifico",
      fontSize: 22,
      color: "#bd6c75",
      italic: true,
      align: "right",
      lineHeight: 1.35,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
    },
    {
      id: "calendar-rule",
      type: "svg",
      x: 70,
      y: 175,
      w: 1060,
      h: 5,
      rotation: 0,
      svgStr:
        '<svg preserveAspectRatio="none" viewBox="0 0 100 2" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1H99" stroke="#d59a9d" stroke-width="2" stroke-linecap="round"/></svg>',
      color: "#d59a9d",
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
    },
    ...monthNames.flatMap((monthName, month) => {
      const x = 70 + (month % 3) * 370;
      const y = 202 + Math.floor(month / 3) * 162;
      return [
        {
          id: `calendar-month-${month + 1}`,
          type: "text" as const,
          x,
          y,
          w: 330,
          h: 22,
          rotation: 0,
          text: monthName,
          fontFamily: "Montserrat",
          fontSize: 14,
          color: month % 2 ? "#4c5875" : "#4d4969",
          bold: true,
          align: "left" as const,
          lineHeight: 1.2,
          opacity: 1,
          visible: true,
          locked: false,
          zIndex: 1,
        },
        {
          id: `calendar-grid-${month + 1}`,
          type: "text" as const,
          x,
          y: y + 24,
          w: 330,
          h: 120,
          rotation: 0,
          text: monthGrid(month),
          fontFamily: "monospace",
          fontSize: 13,
          color: "#555b70",
          bold: false,
          align: "left" as const,
          lineHeight: 1.25,
          opacity: 1,
          visible: true,
          locked: false,
          zIndex: 1,
        },
      ];
    }),
    {
      id: "calendar-footer",
      type: "text",
      x: 70,
      y: 858,
      w: 1060,
      h: 20,
      rotation: 0,
      text: "MAKE ROOM FOR THE GOOD THINGS",
      fontFamily: "Montserrat",
      fontSize: 12,
      color: "#8b6f89",
      bold: true,
      letterSpacing: 2,
      align: "center",
      lineHeight: 1.2,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
    },
  ],
} as unknown as DesignDocument;

export const calendar2027Style = {
  slug: "design-2027-calendar-decorative",
  title: "2027 Decorative Calendar",
  description:
    "A charming editable 2027 calendar with soft colors, playful lettering and twelve tidy monthly blocks.",
  seo_title: "2027 Decorative Calendar Template | EXCPIX",
  seo_description:
    "Create a beautiful 2027 calendar with an editable decorative layout, monthly blocks and playful typography in EXCPIX Design.",
  seo_keywords: [
    "2027 calendar",
    "decorative calendar",
    "editable calendar template",
    "printable calendar",
    "EXCPIX design",
  ],
  image_alt: "2027 decorative calendar template preview",
  style_category: "calendar",
  tags: ["calendar", "2027", "decorative", "planner", "printable"],
  content_json: calendar2027Document,
  metadata: {
    design: calendar2027Document,
  },
};
