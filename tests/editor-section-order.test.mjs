import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,profileSchema,defaultEditorSectionOrder,newApplication,newCustomSection,addCustomSection,removeCustomSection,customSectionKey} from '../lib/model.ts';

test('editor layout migrates and persists independently for each profile and application',()=>{
 const legacy=blankProfile();delete legacy.settings.editorSectionOrder;
 const profile=profileSchema.parse(legacy);
 assert.deepEqual(profile.settings.editorSectionOrder,[...defaultEditorSectionOrder]);
 const pdfOrder=[...profile.settings.sectionOrder];
 [profile.settings.editorSectionOrder[0],profile.settings.editorSectionOrder[3]]=[profile.settings.editorSectionOrder[3],profile.settings.editorSectionOrder[0]];
 const saved=profileSchema.parse(JSON.parse(JSON.stringify(profile)));
 assert.equal(saved.settings.editorSectionOrder[0],'experience');
 assert.deepEqual(saved.settings.sectionOrder,pdfOrder);
 const application=newApplication(saved,'Example','Developer');
 application.draft.settings.editorSectionOrder.reverse();
 assert.equal(saved.settings.editorSectionOrder[0],'experience');
});

test('custom section editor positions survive saving and are cleaned up on deletion',()=>{
 const custom=newCustomSection(),id=customSectionKey(custom.id);
 const profile=addCustomSection(blankProfile(),custom);
 assert.equal(profile.settings.editorSectionOrder.at(-1),id);
 profile.settings.editorSectionOrder=[id,...profile.settings.editorSectionOrder.filter(key=>key!==id)];
 assert.equal(profileSchema.parse(profile).settings.editorSectionOrder[0],id);
 const removed=profileSchema.parse(removeCustomSection(profile,custom.id));
 assert.ok(!removed.settings.editorSectionOrder.includes(id));
 const invalid=blankProfile();invalid.settings.editorSectionOrder=['personal','personal'];
 assert.equal(profileSchema.safeParse(invalid).success,false);
 invalid.settings.editorSectionOrder=['unknown'];
 assert.equal(profileSchema.safeParse(invalid).success,false);
});
