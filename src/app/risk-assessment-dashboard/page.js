"use client";
import LargeSidebar from "../components/LargeSidebar";
import { ButtonRiskAssessment } from "../components/Button";
import { buttonRiskAssessment } from "../data/Data";
import RightSidebar from "../components/RightSidebar";

export default function RiskAssessmentDashboard() {
  return (
    <main className="flex flex-row h-screen overflow-hidden p-6 bg-white gap-4">
      <LargeSidebar />
      <div className="flex flex-col gap-15 w-full h-full">
        <header className="w-full p-4">
          <h1 className="text-[#034f75] font-extrabold text-2xl ml-8">
            Risk Assessment
          </h1>
        </header>
        {/* <h1 className="text-center bg-[#141D38] p-3 font-bold rounded-2xl text-white">Menu</h1> */}
        <div className="grid grid-cols-4 gap-6 p-6 h-fit w-fit mt-[-50px] ">
          {buttonRiskAssessment.map((item, index) => (
            <ButtonRiskAssessment key={index} {...item} />
          ))}
        </div>
      </div>
      <RightSidebar />
    </main>
  );
}


// [#e6f7fb]