/* 各地点的沙盘配方汇总。国家 / 大地区为半开放（mode:'open'），小地点为完整底座（mode:'closed'）。 */
import { STYLES } from './props.js?v=23';
import { COUNTRIES } from './places-open.js?v=23';
import { SITES } from './places-closed.js?v=23';

export { STYLES };
export const RECIPES = { ...COUNTRIES, ...SITES };
