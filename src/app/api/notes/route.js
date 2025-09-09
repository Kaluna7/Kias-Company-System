import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET() {
  const notes = await prisma.notes.findMany();
  return Response.json(notes);
}

export async function POST(req) {
  const body = await req.json();
  const { title, description } = body;
  const newNote = await prisma.notes.create({
    data: { title, description },
  });
  return Response.json(newNote);
}

export async function PUT(req) {
  const body = await req.json();
  const { id, title, description } = body;
  const updateNote = await prisma.notes.update({
    where: { id: Number(id) },
    data: { title, description },
  });
  return Response.json(updateNote);
}

export async function DELETE(req) {
  const body = await req.json();
  const { id } = body;
  await prisma.notes.delete({
    where: { id: Number(id) },
  });
  return Response.json({ message: "Note Deleted" });
}
