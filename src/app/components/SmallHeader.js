import Image from "next/image";
import { Button, DropDown, Search } from "../utils/Button";

export default function SmallHeader({label}){

    function handleClick(){
        console.log("test")
    }
    return(
        <div className="w-full z-200">
                <header className="w-full bg-[#141D38] h-12 flex items-center justify-between fixed border-b border-white">
            <Image 
            src= "/images/kias-logo.png"
            width={45}
            height={45}
            alt="kias logo"
            className="ml-1"
            />
            <div className="flex flex-row gap-8 ml-[-90px]">
                <Button onClick={handleClick()} label="Add New" style="cursor-pointer text-white text-sm hover:text-yellow-400 hover:scale-98"/>
                <Button onClick={handleClick()} label="Edit" style="cursor-pointer text-white text-sm hover:text-yellow-400 hover:scale-98"/>
                <DropDown />
            </div>
            <Search />
                <h1 className="text-[#141D38] mr-10 rounded-2xl bg-white text-sm font-bold px-4 py-1 inset-shadow-sm inset-shadow-[#141D38]/50">{label}</h1>
            </header>
            </div>
    );
}