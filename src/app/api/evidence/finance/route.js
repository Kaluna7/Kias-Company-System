import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import prisma from "@/app/lib/prisma";

// POST - Upload file for evidence
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const risk_id = formData.get("risk_id");
    const ap_code = formData.get("ap_code"); // This is risk_id_no
    const department = formData.get("department");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

    // Save to database using risk_id (not ap_id)
    const riskIdNum = risk_id ? parseInt(risk_id) : null;
    
    // Check if evidence already exists for this risk_id
    const existingEvidence = await prisma.evidence.findFirst({
      where: {
        department: department.toUpperCase(),
        ap_code: ap_code, // Use ap_code (risk_id_no) to find existing evidence
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
          ap_id: riskIdNum, // Store risk_id in ap_id field for backward compatibility
          ap_code: ap_code || null, // Store risk_id_no as ap_code
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
      const riskIdNum = evidence.risk_id ? parseInt(evidence.risk_id) : null;
      const apCode = evidence.ap_code || null; // This is risk_id_no
      
      const existingEvidence = await prisma.evidence.findFirst({
        where: {
          department: department.toUpperCase(),
          ap_code: apCode, // Find by ap_code (risk_id_no)
        },
      });

      if (existingEvidence) {
        // Update existing
        await prisma.evidence.update({
          where: { id: existingEvidence.id },
          data: {
            preparer: preparer || null,
            ap_id: riskIdNum || existingEvidence.ap_id, // Store risk_id
            ap_code: apCode || null, // Store risk_id_no as ap_code
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
            ap_id: riskIdNum, // Store risk_id
            ap_code: apCode || null, // Store risk_id_no as ap_code
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
    const department = searchParams.get("department") || "FINANCE";
    const risk_id = searchParams.get("risk_id");
    const ap_code = searchParams.get("ap_code"); // risk_id_no

    const where = {
      department: department.toUpperCase(),
    };

    if (risk_id) {
      where.ap_id = parseInt(risk_id); // ap_id stores risk_id
    }
    if (ap_code) {
      where.ap_code = ap_code; // ap_code stores risk_id_no
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

