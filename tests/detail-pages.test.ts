import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DetailPage } from "@/renderer/components/DetailPage";
import type { DetailKind } from "@/shared/content-types";

const fixtures: Array<[DetailKind, Record<string, unknown>, string[]]> = [
  ["class", { class:{id:"c1",name:"Real Algebra"}, metrics:{averagePercentage:84,gradedCount:4,missingCount:2,awaitingGradeCount:1,onTrackCount:1,needsAttentionCount:0,atRiskCount:0,noEvidenceCount:0}, statusByStudent:{s1:"on_track"}, students:[{id:"s1",name:"Real Student",avg_grade:88,graded_assignments:4,total_assignments:5,missing_assignments:1}], assignments:[{assignmentId:"a1",title:"Real Assignment",averagePercentage:85,gradedCount:4,expectedCount:5,missingCount:1}] }, ["Real Algebra","Class Average","Missing Work","Performance Status","Class Attention Summary","Students","Real Student","Assignment Performance","Real Assignment"]],
  ["student", { student:{id:"s1",name:"Real Student"}, class:{id:"c1",name:"Real Algebra"}, progress:{avg_assignment_grade:88,graded_assignments:1,missing_assignments:1}, rollup:{gradedInDateOrder:[{assignmentId:"a1",title:"Real Work",percentage:88}],questions:{total:2,correct:1,incorrect:1,uncertain:0},items:[{assignmentId:"a1",title:"Real Work",percentage:88,state:"graded"}]}, status:"on_track", methodMatch:[{paperSubmissionId:"p1",assignmentTitle:"Real Work",conceptName:"Fractions",matchPercentage:92}], insight:{overallSummary:"Existing insight"} }, ["Real Student","Real Algebra","Average Grade","Completion","Performance Over Time","Existing insight","Question-Level Results","Assignment History","Method Match History"]],
  ["assignment", { assignment:{id:"internal-assignment-id",classId:"internal-class-id",title:"Real Assignment",className:"Real Algebra",section:"Period 2",dueDate:"2026-10-10",maxPoints:20,status:"PUBLISHED"}, answerKey:{configured:true,totalQuestions:10,conceptName:"Fractions",updatedAt:"2026-10-01"}, counts:{expected:12,handedIn:9,graded:7,awaitingGrade:2,flaggedForReview:1}, averagePercentage:86, submissions:[{studentId:"internal-student-id",studentName:"Avery Student",state:"TURNED_IN",late:false,handedIn:true,officialGrade:18,officialPercentage:90,analysis:{status:"graded",questions:{flaggedForReview:1}}}] }, ["Real Assignment","Real Algebra","Period 2","PUBLISHED","Due Oct 10, 2026","20 points","Submissions","9","Graded","7","Awaiting Review","2","Average Grade","86%","Grading setup","Answer key","Configured","Questions","10","Method taught","Fractions","Student work","Avery Student","18/20","1 flagged"]],
  ["curriculum", { textbook:{id:"t1",title:"Real Textbook",status:"ready",pageCount:120,processedPages:120}, structure:{available:true,nodes:[{title:"Real Chapter",kind:"chapter",startPdfPage:4}]} }, ["Real Textbook","Page Count","120","Real Chapter"]],
  ["draft", { draft:{id:"d1",title:"Real Draft",className:"Real Algebra",maxPoints:15,status:"DRAFT"}, setup:{answerKeyConfigured:false,conceptName:"Fractions"} }, ["Real Draft","Real Algebra","Answer Key Configured","No","Fractions"]],
  ["library", { concept:{id:"l1",name:"Real Concept",subject:"Math",description:"Real description"}, summary:{teaching_method:"Visual models"}, resources:[{fileName:"real.pdf",fileType:"application/pdf"}] }, ["Real Concept","Real description","Visual models","real.pdf"]],
];

describe("Hub-native detail screens", () => {
  it.each(fixtures)("renders real %s detail", (kind, data, expected) => {
    const html=renderToStaticMarkup(createElement(DetailPage,{kind,data,loading:false,error:false,onBack:vi.fn()}));
    expect(html).toContain("‹ Back"); for(const value of expected)expect(html).toContain(value);
  });
  it("contains no viewing redirect fallback",()=>{
    const source=readFileSync(new URL("../src/renderer/components/ContentPages.tsx",import.meta.url),"utf8")+readFileSync(new URL("../src/renderer/components/DetailPage.tsx",import.meta.url),"utf8");
    expect(source).not.toMatch(/Open class progress on|View submissions on web|View resources in TeacherLyft\.com|Open in TeacherLyft\.com|Open on web/i);
    expect(source).toContain("Set up on web"); expect(source).toContain("Upload on web");
  });
  it("never exposes internal IDs or raw progress field names",()=>{
    for(const [kind,data] of fixtures.slice(0,2)){const html=renderToStaticMarkup(createElement(DetailPage,{kind,data,loading:false,error:false,onBack:vi.fn()}));expect(html).not.toContain(">Id<");expect(html).not.toContain("Graded Count");expect(html).not.toContain("No Evidence Count");expect(html).not.toContain(">c1<");expect(html).not.toContain(">s1<");}
  });
  it("maps assignment data into TeacherLyft UI without raw API labels or IDs",()=>{
    const [,data]=fixtures[2]; const html=renderToStaticMarkup(createElement(DetailPage,{kind:"assignment",data,loading:false,error:false,onBack:vi.fn()}));
    for(const hidden of ["internal-assignment-id","internal-class-id","internal-student-id","Class Id","Configured</dt>","Updated At","Total Questions","Concept Name","Graded Count","Submission Count","Awaiting Grade Count","Counts"]) expect(html).not.toContain(hidden);
  });
  it("renders real zero assignment counts and an unconfigured answer key",()=>{
    const data={assignment:{id:"a0",title:"New Work",className:"Math",dueDate:null,maxPoints:0,status:"DRAFT"},answerKey:{configured:false,totalQuestions:null,conceptName:null},counts:{expected:0,handedIn:0,graded:0,awaitingGrade:0,flaggedForReview:0},averagePercentage:null,submissions:[]};
    const html=renderToStaticMarkup(createElement(DetailPage,{kind:"assignment",data,loading:false,error:false,onBack:vi.fn()}));
    expect(html).toContain("No due date"); expect(html).toContain("0 points"); expect(html).toContain("Not set"); expect(html).toContain("Not linked"); expect(html.match(/<strong>0<\/strong>/g)?.length).toBeGreaterThanOrEqual(3); expect(html).toContain("No students are enrolled");
  });
});
