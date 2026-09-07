import type {ChapterDef} from './types';
import Pipeline from '../chapters/01-pipeline/chapter';
import {narrations} from '../chapters/01-pipeline/narrations';
export const CHAPTERS:ChapterDef[]=[{id:'pipeline',title:'Creator Pipeline',narrations,Component:Pipeline}];
