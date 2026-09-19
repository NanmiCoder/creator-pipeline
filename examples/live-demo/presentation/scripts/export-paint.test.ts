import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForSceneTime } from '../src/export/paint.ts';

test('a stale scene times out instead of exporting the preceding frame',async()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>({dataset:{time:'0.000'}})}});
  try {await assert.rejects(waitForSceneTime(1,new AbortController().signal,10),/画面未就绪/)}
  finally {if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document')}
});
test('committed fractional frame needs no live animation-frame callback',async()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>({dataset:{time:'3.609'}})}});
  try {await waitForSceneTime(3.576+1/30,new AbortController().signal)}
  finally {if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document')}
});
