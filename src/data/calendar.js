/**
 * 30-turn expedition calendar and solar declination table (δ)
 * Matches the B4 reference chart (5월 초 ~ 2월 말, 1 turn = 10 days).
 */
export const TURN_CALENDAR = [
  { turn: 1, label: '5월 초', shortLabel: '5초', declination: 15.5 },
  { turn: 2, label: '5월 중', shortLabel: '5중', declination: 18.5 },
  { turn: 3, label: '5월 말', shortLabel: '5말', declination: 21.0 },
  { turn: 4, label: '6월 초', shortLabel: '6초', declination: 22.5 },
  { turn: 5, label: '6월 중', shortLabel: '6중', declination: 23.5 },
  { turn: 6, label: '6월 말', shortLabel: '6말', declination: 23.5 },
  { turn: 7, label: '7월 초', shortLabel: '7초', declination: 22.5 },
  { turn: 8, label: '7월 중', shortLabel: '7중', declination: 21.5 },
  { turn: 9, label: '7월 말', shortLabel: '7말', declination: 19.0 },
  { turn: 10, label: '8월 초', shortLabel: '8초', declination: 16.5 },
  { turn: 11, label: '8월 중', shortLabel: '8중', declination: 14.0 },
  { turn: 12, label: '8월 말', shortLabel: '8말', declination: 10.5 },
  { turn: 13, label: '9월 초', shortLabel: '9초', declination: 7.0 },
  { turn: 14, label: '9월 중', shortLabel: '9중', declination: 3.0 },
  { turn: 15, label: '9월 말', shortLabel: '9말', declination: -1.0 },
  { turn: 16, label: '10월 초', shortLabel: '10초', declination: -5.0 },
  { turn: 17, label: '10월 중', shortLabel: '10중', declination: -8.5 },
  { turn: 18, label: '10월 말', shortLabel: '10말', declination: -12.5 },
  { turn: 19, label: '11월 초', shortLabel: '11초', declination: -16.0 },
  { turn: 20, label: '11월 중', shortLabel: '11중', declination: -19.0 },
  { turn: 21, label: '11월 말', shortLabel: '11말', declination: -21.0 },
  { turn: 22, label: '12월 초', shortLabel: '12초', declination: -22.5 },
  { turn: 23, label: '12월 중', shortLabel: '12중', declination: -23.5 },
  { turn: 24, label: '12월 말', shortLabel: '12말', declination: -23.5 },
  { turn: 25, label: '1월 초', shortLabel: '1초', declination: -22.5 },
  { turn: 26, label: '1월 중', shortLabel: '1중', declination: -21.0 },
  { turn: 27, label: '1월 말', shortLabel: '1말', declination: -18.5 },
  { turn: 28, label: '2월 초', shortLabel: '2초', declination: -15.5 },
  { turn: 29, label: '2월 중', shortLabel: '2중', declination: -12.5 },
  { turn: 30, label: '2월 말', shortLabel: '2말', declination: -9.0 },
];

export const MAX_TURNS = 30;

export function getTurnInfo(turn) {
  const clamped = Math.max(1, Math.min(MAX_TURNS, turn));
  return TURN_CALENDAR[clamped - 1];
}
