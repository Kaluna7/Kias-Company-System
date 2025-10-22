
import { RiDeleteBin6Fill } from "react-icons/ri";
import { AiOutlineEye } from "react-icons/ai";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useNoteStore } from "@/app/stores/ComponentsStore/notepad";
import { viewPopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useEffect } from "react";

export function Note() {
  const notes = useNoteStore((s) => s.notes);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  // const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);

  const addPopUp = usePopUp((s) => s.openPopUp);
  const showViewPopUp = viewPopUp((s) => s.openViewPopUp);

  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <div className="flex flex-col text-white h-full w-full gap-2">
      <div className="flex flex-row justify-between items-center">
        <h1 className="font-bold text-lg">Note</h1>
        <button
          className="bg-white text-black px-2 rounded-xl"
          onClick={() => addPopUp(null)}
        >
          New
        </button>
      </div>

      <div className="h-full w-full bg-white rounded-2xl text-black p-2 max-h-80 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-row bg-amber-200 gap-2 items-center rounded-2xl p-2 "
            >
              <div className="flex-1">
                <b>{note.title}</b>
              </div>
              <button onClick={showViewPopUp} className="px-2">
                <AiOutlineEye className="text-green-400 cursor-pointer hover:scale-110 hover:bg-gray-500" />
              </button>
              <button onClick={() => deleteNote(note.id)} className="px-2">
                <RiDeleteBin6Fill className="text-green-400 cursor-pointer hover:scale-110 hover:bg-gray-500" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
