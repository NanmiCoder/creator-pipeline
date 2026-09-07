import type {ChapterDef} from "./types";
import Pipeline from "../chapters/01-pipeline/chapter";
import {narrations} from "../chapters/01-pipeline/narrations";
import {timing} from "../chapters/01-pipeline/timing";

export const CHAPTERS: ChapterDef[] = [{
  id: "pipeline", title: "Creator Pipeline", narrations, Component: Pipeline,
  // Explicit silent starter only. Real generated audio always takes precedence.
  // Remove previewTiming when replacing this example with your own chapters.
  previewTiming: timing,
}];
