import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'url';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { connectDB } from '../config/db.js';

export const seedData = async (shouldExit = true, clearFirst = true) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    if (clearFirst) {
      await User.deleteMany({});
      await Form.deleteMany({});
      await Submission.deleteMany({});
      await Nomination.deleteMany({});
      console.log('\uD83D\uDDD1\uFE0F Existing data cleared');
    }

    const salt = await bcrypt.genSalt(12);

    const admin = await User.create({
      email: 'admin@school.edu',
      passwordHash: await bcrypt.hash('admin123', salt),
      role: 'admin',
      profile: { fullName: 'System Administrator' }
    });

    const reviewersData = [
      { email: 'reviewer1@cbss.edu', passwordHash: await bcrypt.hash('review123', salt), role: 'reviewer', profile: { fullName: 'Reviewer One' } },
      { email: 'priya.reviewer@school.edu', passwordHash: await bcrypt.hash('reviewer123', salt), role: 'reviewer', profile: { fullName: 'Priya Reviewer' } }
    ];
    for (const r of reviewersData) {
      await User.create(r);
    }

    const functionariesData = [
      { email: 'head.mh054@cbss.school.org', role: 'functionary', profile: { fullName: 'Head MH054', schoolCode: 'MH054' } },
      { email: 'head.kv001@cbss.school.org', role: 'functionary', profile: { fullName: 'Head KV001', schoolCode: 'KV001' } }
    ];
    for (const f of functionariesData) {
      await User.create(f);
    }

    const teachersData = [
      { email: 'teacher1@school.edu', role: 'teacher', profile: { fullName: 'Teacher One' } },
      { email: 'teacher2@school.edu', role: 'teacher', profile: { fullName: 'Teacher Two' } },
      { email: 'anita.teacher@school.edu', role: 'teacher', profile: { fullName: 'Anita Teacher' } }
    ];
    const teachers = [];
    for (const t of teachersData) {
      teachers.push(await User.create(t));
    }

    console.log('✅ Users seeded');

    const forms = await Form.insertMany([
      {
        title: 'Annual Teacher Performance Survey 2024',
        description: 'Standard performance review form for all teachers.',
        adminId: admin._id,
        status: 'active',
        formType: 'normal',
        shareableLink: 'normal-form-1',
        form_schema: {
          sections: [{
            id: 's1', title: 'Performance Review', fields: [
              { id: "f1", type: "text", label: "Full Name", required: true, placeholder: "Enter your full name" },
              { id: "f2", type: "email", label: "Email Address", required: true, placeholder: "your.email@school.edu" },
              { id: "f3", type: "phone", label: "Phone Number", placeholder: "+91 98765 43210" },
              { id: "f4", type: "dropdown", label: "Subject", required: true, options: ["Mathematics", "Science", "English", "Hindi", "Social Studies", "Computer Science", "Physical Education", "Art"] },
              { id: "f5", type: "dropdown", label: "Grade/Class Teaching", options: ["Grade 1-5", "Grade 6-8", "Grade 9-10", "Grade 11-12"] },
              { id: "f6", type: "number", label: "Years of Teaching Experience", required: true },
              { id: "f7", type: "radio", label: "Self Assessment Rating", required: true, options: ["1 - Needs Improvement", "2 - Satisfactory", "3 - Good", "4 - Very Good", "5 - Excellent"] },
              { id: "f8", type: "textarea", label: "Key Achievements This Year", required: true, placeholder: "Describe your major accomplishments...", maxLength: 1000 },
              { id: "f9", type: "textarea", label: "Professional Development Activities", placeholder: "Workshops, certifications, training attended..." },
              { id: "f10", type: "textarea", label: "Goals for Next Year", placeholder: "What do you aim to achieve?" }
            ]
          }]
        }
      },
      {
        title: 'Best Teacher Award Nomination 2024',
        description: 'Principals nominate their best teachers.',
        adminId: admin._id,
        status: 'active',
        formType: 'nomination',
        shareableLink: 'nomination-form-2',
        settings: { nomination_limit: 5 },
        form_schema: {
          sections: [{
            id: 's1', title: 'Nomination Details', fields: [
              { id: "n1", type: "text", label: "Full Name (as on government ID)", required: true },
              { id: "n2", type: "email", label: "Personal Email", required: true },
              { id: "n3", type: "phone", label: "Mobile Number", required: true },
              { id: "n4", type: "date", label: "Date of Birth", required: true },
              { id: "n5", type: "radio", label: "Gender", options: ["Female", "Male", "Non-binary", "Prefer not to say"], required: true },
              { id: "n6", type: "text", label: "Current RAJUation" },
              { id: "n7", type: "dropdown", label: "Highest Qualification", options: ["Diploma", "B.Ed", "M.Ed", "M.Phil", "PhD", "Other"], required: true },
              { id: "n8", type: "number", label: "Total Teaching Experience (years)", required: true },
              { id: "n9", type: "textarea", label: "Describe your top 3 pedagogical innovations", required: true, maxLength: 600 },
              { id: "n10", type: "file", label: "Upload CV (PDF, max 5MB)", required: true, fileTypes: "pdf", maxSizeMB: 5 },
              { id: "n11", type: "checkbox", label: "I confirm that:", options: ["All information is true", "I have obtained my principal's consent"], required: true },
              { id: "n12", type: "text", label: "Digital Signature", required: true }
            ]
          }]
        }
      },
      {
        title: 'School Infrastructure Assessment',
        description: 'Branching form based on subject department.',
        adminId: admin._id,
        status: 'active',
        formType: 'branching',
        shareableLink: 'branching-form-3',
        form_schema: {
          sections: [
            {
              id: 's1', title: 'General Info', fields: [
                { id: "b1", type: "dropdown", label: "Your Subject", required: true, options: ["Mathematics", "Science", "English", "Hindi"] },
                { id: "b2", type: "text", label: "Full Name", required: true },
                { id: "b3", type: "number", label: "Years of Experience", required: true }
              ]
            },
            {
              id: "grp_maths", title: "Mathematics Section",
              visibleIf: { fieldId: "b1", op: "eq", value: "Mathematics" },
              fields: [
                { id: "m1", type: "dropdown", label: "Board syllabus you follow", options: ["CBSE", "ICSE", "State Board"], required: true },
                { id: "m2", type: "number", label: "Average class score in last exam" },
                { id: "m3", type: "textarea", label: "Describe your approach to teaching Algebra" }
              ]
            },
            {
              id: "grp_science", title: "Science Section",
              visibleIf: { fieldId: "b1", op: "eq", value: "Science" },
              fields: [
                { id: "s1", type: "dropdown", label: "Science stream", options: ["Physics", "Chemistry", "Biology", "General Science"], required: true },
                { id: "s2", type: "checkbox", label: "Lab facilities available", options: ["Physics Lab", "Chemistry Lab", "Biology Lab", "Computer Lab"] },
                { id: "s3", type: "textarea", label: "Describe a recent practical session you conducted" }
              ]
            },
            {
              id: "grp_english", title: "English Section",
              visibleIf: { fieldId: "b1", op: "eq", value: "English" },
              fields: [
                { id: "e1", type: "radio", label: "Medium of instruction", options: ["Pure English", "Bilingual", "English-mostly"], required: true },
                { id: "e2", type: "checkbox", label: "Literature taught", options: ["Poetry", "Drama", "Novels", "Short stories", "Non-fiction"] },
                { id: "e3", type: "textarea", label: "How do you encourage reading habits?", maxLength: 500 }
              ]
            },
            {
              id: "grp_hindi", title: "Hindi Section",
              visibleIf: { fieldId: "b1", op: "eq", value: "Hindi" },
              fields: [
                { id: "h1", type: "radio", label: "Teaching approach", options: ["Grammar-first", "Literature-first", "Balanced"], required: true },
                { id: "h2", type: "textarea", label: "Describe a creative Hindi class activity", maxLength: 500 }
              ]
            },
            {
              id: 's_final', title: 'Feedback', fields: [
                { id: "b_final", type: "textarea", label: "Any additional comments or feedback" }
              ]
            }
          ]
        }
      },
      {
        title: 'CBSE Curriculum Knowledge Quiz',
        description: 'MCQ quiz with timer, negative marking and auto-scoring.',
        adminId: admin._id,
        status: 'active',
        formType: 'quiz',
        shareableLink: 'quiz-form-4',
        form_schema: {
          sections: [{
            id: 's1', title: 'Questions', fields: [
              { id: "q1", type: "mcq", label: "Who wrote the Indian national anthem?", options: ["Rabindranath Tagore", "Bankim Chandra", "Sarojini Naidu", "Subhash Chandra Bose"], correct: 0, marks: 10 },
              { id: "q2", type: "mcq", label: "The Right to Education Act guarantees free education for children aged…", options: ["3–12", "5–14", "6–14", "6–16"], correct: 2, marks: 10 },
              { id: "q3", type: "mcq", label: "What year was the National Education Policy (NEP) introduced?", options: ["2018", "2019", "2020", "2021"], correct: 2, marks: 10 },
              { id: "q5", type: "mcq", label: "Under NEP 2020, the new school structure is:", options: ["10+2", "5+3+3+4", "6+3+3", "4+4+4"], correct: 1, marks: 10 },
              { id: "q6", type: "mcq", label: "Multiple Intelligences theory was proposed by…", options: ["Piaget", "Vygotsky", "Howard Gardner", "Bandura"], correct: 2, marks: 10 }
            ]
          }]
        },
        settings: { time_limit_min: 15, passing_score: 60, negative_marking: true, shuffle: true }
      },
      {
        title: 'Multi-Part School Readiness Assessment',
        description: 'Hybrid form combining Normal + Branching + Quiz sections.',
        adminId: admin._id,
        status: 'active',
        formType: 'multi',
        shareableLink: 'multi-form-5',
        settings: { time_limit_min: 20, passing_score: 50, negative_marking: true, shuffle: true },
        form_schema: {
          sections: [
            {
              id: 's1', title: 'Basic Info', fields: [
                { id: "mu1", type: "text", label: "Full Name", required: true },
                { id: "mu2", type: "email", label: "Official Email", required: true },
                { id: "mu3", type: "phone", label: "Mobile Number", required: true },
                { id: "mu4", type: "dropdown", label: "Department", required: true, options: ["Primary", "Middle", "Senior", "Sports", "Arts"] }
              ]
            },
            {
              id: "grp_primary", title: "Primary Department Questions",
              visibleIf: { fieldId: "mu4", op: "eq", value: "Primary" },
              fields: [
                { id: "mp1", type: "textarea", label: "Describe your phonics strategy for Grade 1", required: true },
                { id: "mp2", type: "checkbox", label: "Play-based tools used", options: ["Blocks", "Flashcards", "Songs", "Storytelling"] }
              ]
            },
            {
              id: "grp_senior", title: "Senior Department Questions",
              visibleIf: { fieldId: "mu4", op: "eq", value: "Senior" },
              fields: [
                { id: "ms1", type: "textarea", label: "How do you prepare students for board exams?", required: true },
                { id: "ms2", type: "number", label: "Average board exam pass percentage" }
              ]
            },
            {
              id: 's_quiz', title: 'Pedagogy Quiz', fields: [
                { id: "mq1", type: "mcq", label: "Bloom's Taxonomy highest-order cognitive skill is…", options: ["Analysis", "Evaluation", "Create", "Remember"], correct: 2, marks: 10 },
                { id: "mq2", type: "mcq", label: "Formative assessment primarily aims to…", options: ["Rank students", "Improve learning", "Award grades", "Select for promotion"], correct: 1, marks: 10 },
                { id: "mq3", type: "mcq", label: "The zone of proximal development is a concept by…", options: ["Piaget", "Vygotsky", "Skinner", "Bruner"], correct: 1, marks: 10 }
              ]
            }
          ]
        }
      }
    ]);

    console.log('✅ Forms seeded');

    // Seed some Nominations
    const nomination = await Nomination.create({
      form_id: forms[1]._id,
      functionary_id: (await User.findOne({ role: 'functionary' }))?._id,
      teacher_name: 'Teacher One',
      teacher_email: 'teacher1@school.edu',
      school_code: 'MH054',
      status: 'completed',
      unique_token: 'test-token-123'
    });

    // Seed some Submissions
    await Submission.create({
      formId: forms[0]._id,
      userId: teachers[0]._id,
      userName: teachers[0].profile.fullName,
      userEmail: teachers[0].email,
      formTitle: forms[0].title,
      status: 'submitted',
      responses: [
        { fieldId: 'f1', value: 'Teacher One' },
        { fieldId: 'f4', value: 'Mathematics' }
      ],
      createdAt: new Date()
    });

    await Submission.create({
      formId: forms[1]._id,
      nominationId: nomination._id,
      nominationToken: 'test-token-123',
      userId: teachers[0]._id,
      userName: 'Teacher One',
      userEmail: 'teacher1@school.edu',
      schoolCode: 'MH054',
      formTitle: forms[1].title,
      status: 'under_review',
      responses: [
        { fieldId: 'n1', value: 'Teacher One' },
        { fieldId: 'n2', value: 'teacher1@school.edu' }
      ],
      createdAt: new Date(Date.now() - 86400000) // 1 day ago
    });

    console.log('✅ Submissions seeded');

    if (shouldExit) process.exit(0);
  } catch (err: any) {
    console.error('\u274C Seed error:', err.message);
    if (shouldExit) process.exit(1);
  }
};

// Use file URL comparison that works across Windows/Unix path formats.
const executedFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === executedFileUrl) {
  seedData();
}
