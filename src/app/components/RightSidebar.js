import { MyCalendar } from "./Accessories";

export default function RightSidebar(){
    return(
        <div className="h-full w-[18%] bg-[#141D38] rounded-2xl flex flex-col p-2">
            <MyCalendar />
        </div>
    );
}