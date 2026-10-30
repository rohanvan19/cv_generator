import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorkspace,demoProfile,newApplication,duplicateApplication,workspaceSchema} from '../lib/model.ts';

test('duplicate keeps application content in an independent new draft for another company',()=>{
 const master=demoProfile(),source=newApplication(master,'Original company','Engineer');
 source.status='Applied';source.createdAt='2020-01-01T00:00:00.000Z';
 source.draft.summary.en='Application-specific summary';source.coverLetter.en='Letter for original company';
 const before=structuredClone(source),copy=duplicateApplication(source,'New company','Senior Engineer');
 assert.notEqual(copy.id,source.id);assert.notEqual(copy.createdAt,source.createdAt);
 assert.equal(copy.status,'Draft');assert.equal(copy.company,'New company');assert.equal(copy.role,'Senior Engineer');
 assert.deepEqual(copy.draft,source.draft);assert.deepEqual(copy.coverLetter,source.coverLetter);
 const state={...blankWorkspace(),profile:master,applications:[copy,source]};
 assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(state))).applications,[copy,source]);
 copy.draft.experience[0].description.en='Changed copied experience';copy.draft.settings.language='en';copy.coverLetter.en='New company letter';
 assert.deepEqual(source,before);assert.notEqual(master.summary.en,'Application-specific summary');
});
