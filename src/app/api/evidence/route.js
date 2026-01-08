import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import prisma from "@/app/lib/prisma";

// Generic API endpoint for all departments
// Usage: /api/evidence?department=FINANCE

// POST - Upload file for evidence
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const ap_id = formData.get("ap_id");
    const ap_code = formData.get("ap_code");
    const department = formData.get("department");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!department) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "evidence", department.toLowerCase());
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const fileExtension = originalName.split(".").pop();
    const fileName = `${ap_code || "file"}_${timestamp}.${fileExtension}`;
    const filePath = join(uploadsDir, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return file URL and name
    const fileUrl = `/uploads/evidence/${department.toLowerCase()}/${fileName}`;

    // Save to database
    const apIdNum = ap_id ? parseInt(ap_id) : null;
    
    // Check if evidence already exists for this AP
    const existingEvidence = await prisma.evidence.findFirst({
      where: {
        department: department.toUpperCase(),
        ap_id: apIdNum,
      },
    });

    if (existingEvidence) {
      // Update existing evidence
      await prisma.evidence.update({
        where: { id: existingEvidence.id },
        data: {
          file_url: fileUrl,
          file_name: originalName,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new evidence
      await prisma.evidence.create({
        data: {
          department: department.toUpperCase(),
          ap_id: apIdNum,
          ap_code: ap_code || null,
          file_url: fileUrl,
          file_name: originalName,
          status: "IN PROGRESS",
        },
      });
    }

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: originalName,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}

// PUT - Save evidence data
export async function PUT(req) {
  try {
    const body = await req.json();
    const { department, preparer, overallStatus, evidenceData } = body;

    if (!department) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    // Update or create evidence records
    for (const evidence of evidenceData) {
      const apIdNum = evidence.ap_id ? parseInt(evidence.ap_id) : null;
      
      const existingEvidence = await prisma.evidence.findFirst({
        where: {
          department: department.toUpperCase(),
          ap_id: apIdNum,
        },
      });

      if (existingEvidence) {
        // Update existing
        await prisma.evidence.update({
          where: { id: existingEvidence.id },
          data: {
            preparer: preparer || null,
            ap_code: evidence.ap_code || null,
            substantive_test: evidence.substantive_test || null,
            file_url: evidence.attachment || existingEvidence.file_url,
            file_name: evidence.file_name || existingEvidence.file_name,
            status: evidence.status || "IN PROGRESS",
            overall_status: overallStatus || "IN PROGRESS",
            updated_at: new Date(),
          },
        });
      } else {
        // Create new
        await prisma.evidence.create({
          data: {
            department: department.toUpperCase(),
            preparer: preparer || null,
            ap_id: apIdNum,
            ap_code: evidence.ap_code || null,
            substantive_test: evidence.substantive_test || null,
            file_url: evidence.attachment || null,
            file_name: evidence.file_name || null,
            status: evidence.status || "IN PROGRESS",
            overall_status: overallStatus || "IN PROGRESS",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Evidence data saved successfully",
    });
  } catch (error) {
    console.error("Error saving evidence data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save evidence data" },
      { status: 500 }
    );
  }
}

// GET - Fetch evidence data
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");
    const ap_id = searchParams.get("ap_id");

    if (!department) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    const where = {
      department: department.toUpperCase(),
    };

    if (ap_id) {
      where.ap_id = parseInt(ap_id);
    }

    const evidenceData = await prisma.evidence.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: evidenceData,
    });
  } catch (error) {
    console.error("Error fetching evidence data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch evidence data" },
      { status: 500 }
    );
  }
}

