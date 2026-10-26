import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {captureConversation,readCaptureResult} from '../src/extract.js';

test('injected capture returns serializable setup errors when requested',async()=>{
  const context={location:{protocol:'https:',hostname:'example.com'}};
  const run=vm.runInNewContext('('+captureConversation.toString()+')',context);
  const result=await run({host:'chatgpt.com'},{reportErrors:true,token:'job-1'});
  assert.match(result.captureError,/page changed/);
  assert.equal(result.token,'job-1');
  assert.equal(JSON.parse(JSON.stringify(result)).captureError,result.captureError);
  await assert.rejects(run({host:'chatgpt.com'},{}),/page changed/);
});
test('result recovery requires matching, finished, non-cancelled capture',()=>{
  const location={href:'https://chatgpt.com/c/test'};
  const job={token:'job-1',sourceUrl:location.href,controller:{signal:{aborted:false}},messages:[{text:'partial'}],lastAccess:0};
  const read=vm.runInNewContext('('+readCaptureResult.toString()+')',{__personalExportCapture:job,location});
  assert.equal(read('job-1'),null);
  job.summary={capture:{messageCount:2}};
  assert.equal(read('other'),null);
  assert.equal(read('job-1').capture.messageCount,2);
  assert(job.lastAccess>0);
  location.href='https://chatgpt.com/c/another';
  assert.equal(read('job-1'),null);
  location.href=job.sourceUrl;
  job.controller.signal.aborted=true;
  assert.equal(read('job-1'),null);
});
