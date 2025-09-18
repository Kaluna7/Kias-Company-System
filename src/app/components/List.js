export function List({ label, placeholder}){
    return(
        <ul>
            <li className="flex flex-col gap-2">
                <h1 className="font-bold text-sm">{label}</h1>
                <input placeholder={placeholder} className="border rounded-sm shadow-xs shadow-black/50 bg-white"/>
            </li>
        </ul>
    );
}