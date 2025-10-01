"use client";
import LargeSidebar from "../components/ui/LargeSidebar";
import { ButtonRiskAssessment } from "../components/features/Button";
import { buttonRiskAssessment } from "../data/Data";
import RightSidebar from "../components/layout/RightSidebar";
import { usePopUp } from "../stores/RiskAssessement/popupStore";
import { NewNotePad, ViewNote } from "../components/ui/NotePad";
import { EditNotePad } from "../components/ui/PopUpRiskAssessmentInput";
import { viewPopUp } from "../stores/RiskAssessement/popupStore";

export default function RiskAssessmentDashboard() {
  const { isOpen, closePopUp } = usePopUp();
  const { isViewOpen, closeViewPopUp } = viewPopUp();

  return (
    <main className="flex flex-row h-screen overflow-hidden p-6 bg-[#E6F0FA] gap-6">
      <LargeSidebar />
      <div className="flex flex-col gap-10 w-full h-full">
        <header className="w-full p-4">
          <h1 className="text-[#034f75] font-extrabold text-2xl ml-8">
            Risk Assessment
          </h1>
        </header>
        {isOpen && <NewNotePad onClose={closePopUp} />}
        {isViewOpen && <ViewNote onClose={closeViewPopUp} />}
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
