import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DetailPage } from "@/renderer/components/DetailPage";
import type { DetailKind } from "@/shared/content-types";

const fixtures: Array<[DetailKind, Record<string, unknown>, string[]]> = [
  ["class", { class:{id:"c1",name:"Real Algebra"}, metrics:{averagePercentage:84,missingCount:2,awaitingGradeCount:1}, students:[{id:"s1",name:"Real Student",avg_grade:88}], assignments:[{id:"a1",title:"Real Assignment",gradedCount:4}] }, ["Real Algebra","Average Percentage","84","Missing Count","Real Student","Real Assignment"]],
  ["student", { student:{id:"s1",name:"Real Student"}, class:{id:"c1",name:"Real Algebra"}, progress:{avg_assignment_grade:88,missing_assignments:1}, status:"on_track", methodMatch:[{assignmentTitle:"Real Work",matchPercentage:92}], insight:{overallSummary:"Existing insight"} }, ["Real Student","Real Algebra","Avg assignment grade","88","Real Work","Existing insight"]],
  ["assignment", { assignment:{id:"a1",title:"Real Assignment",className:"Real Algebra",dueDate:"2026-10-10",maxPoints:20,status:"PUBLISHED"}, counts:{handedIn:9,graded:7,awaitingGrade:2}, averagePercentage:86 }, ["Real Assignment","Real Algebra","Max Points","20","Handed In","9","Awaiting Grade","2"]],
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
});
