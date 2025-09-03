import Image from "next/image";

export default function SmallHeader({label}){
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
            <div className="">

            </div>
                <h1 className="text-white mr-10">{label}</h1>
            </header>
            </div>
    );
}