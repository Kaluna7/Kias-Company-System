import SmallSidebar from "@/app/components/SmallSidebar";
import DummyTable from "@/app/components/DummyTable";
import SmallHeader from "@/app/components/SmallHeader";

export default function Operational() {
  return (
    <main className="flex flex-row w-max h-full">
      <SmallSidebar />
      <div className="flex flex-col">
        <SmallHeader label={"Risk Assessment Form Operational"} />
        <div className="mt-12 ml-14">
          {/* test */}
        </div>
      </div>
    </main>
  );
}
