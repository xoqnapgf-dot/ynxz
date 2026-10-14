// Tiny authored SVGs avoid platform-dependent glyphs in the scene directory.
const paths={
 '900':'M3 11 12 4l9 7M5 10v11h14V10M9 21v-7h6v7',
 '901':'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
 '902':'M2 21 10 4l5 10 2-4 5 11ZM7 11l3 2 3-2',
 '9':'M4 21V9l8-5 8 5v12M2 21h20M8 10v7m4-7v7m4-7v7',
 '12':'M7 2 5 22M17 2l2 20M7 5h10M6 10h12M6 15h12M5 20h14',
 '11':'M3 9 12 3l9 6-9 6ZM3 15l9 6 9-6M12 15v6',
 'falota':'M12 3v15M9 3h6M4 13v3c0 4 8 6 8 6s8-2 8-6v-3M8 9h8',
 'shiomi':'M3 10h18L18 5H6ZM5 10v11h14V10M3 21h18M9 21v-7h6v7',
 'place':'M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13ZM9 9a3 3 0 1 0 6 0 3 3 0 1 0-6 0'
};
export function atlasIcon(key){return `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]||paths.place}"/></svg>`;}
