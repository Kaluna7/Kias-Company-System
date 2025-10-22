"use client";
import LargeSidebar from "../../components/ui/LargeSidebar";
import { ButtonDashboard } from "../../components/features/Button";
import { buttonAuditProgram } from "../../data/auditProgramConfig";
import RightSidebar from "../../components/layout/RightSidebar";
import { usePopUp } from "../../stores/ComponentsStore/popupStore";
import { NewNotePad, ViewNote } from "../../components/ui/NotePad";
import { EditNotePad } from "../../components/ui/PopUpRiskAssessmentInput";
import { viewPopUp } from "../../stores/ComponentsStore/popupStore";

export default function AuditProgram() {
  const { isOpen, closePopUp } = usePopUp();
  const { isViewOpen, closeViewPopUp } = viewPopUp();

  return (
    <main className="flex flex-row h-screen overflow-hidden p-6 bg-[#E6F0FA] gap-6">
      <LargeSidebar />
      <div className="flex flex-col gap-10 w-full h-full">
        <header className="w-full p-4">
          <h1 className="text-[#034f75] font-extrabold text-2xl ml-8">
            Audit Program
          </h1>
        </header>
        {isOpen && <NewNotePad onClose={closePopUp} />}
        {isViewOpen && <ViewNote onClose={closeViewPopUp} />}
        <div className="grid grid-cols-4 gap-6 p-6 h-fit w-fit mt-[-50px] ">
          {buttonAuditProgram.map((item, index) => (
            <ButtonDashboard key={index} {...item} />
          ))}
        </div>
      </div>
      <RightSidebar />
    </main>
  );
}

// [#e6f7fb]
