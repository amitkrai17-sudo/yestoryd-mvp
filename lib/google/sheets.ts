/**
 * Google Sheets Database Client
 * All database operations using Google Sheets as backend
 */

import { getSheetsClient } from './auth';
import { generateId } from '../utils/helpers';

// Master Sheet ID (contains all tabs)
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

// Sheet tab names
const SHEETS = {
  COACHES: 'Coaches',
  PARENTS: 'Parents',
  STUDENTS: 'Students',
  ASSESSMENTS: 'Assessments',
  BOOKINGS: 'Bookings',
  SESSIONS: 'Sessions',
  PAYMENTS: 'Payments',
  COACH_PROFILES: 'CoachProfiles',
  PACKAGES: 'Packages',
} as const;

export interface Coach {
  coachId: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  ageGroups: string;
  availability: string;
  status: string;
  joinDate: string;
  totalSessions: number;
  rating: number;
  bankAccount: string;
  subdomain: string;
}

export interface Parent {
  parentId: string;
  name: string;
  email: string;
  phone: string;
  children: string; // JSON array of studentIds
  coachingClient: boolean;
  servicesAccess: string;
  totalSpent: number;
  joinDate: string;
}

export interface Student {
  studentId: string;
  childName: string;
  age: number;
  parentId: string;
  coachId: string;
  source: string;
  assignmentType: string;
  referralCoach: string;
  status: string;
  createdDate: string;
}

export interface Assessment {
  assessmentId: string;
  studentId: string;
  coachId: string;
  date: string;
  score: number;
  wpm: number;
  fluency: string;
  pronunciation: string;
  passage: string;
  recordingUrl: string;
  geminiAnalysis: string; // JSON string
  assignedToCoach: string;
  source: string;
}

export interface Payment {
  paymentId: string;
  studentId: string;
  coachId: string;
  amount: number;
  coachShare: number;
  yestorydShare: number;
  source: string;
  referralCoach: string;
  assignedBy: string;
  packageType: string;
  razorpayPaymentId: string;
  status: string;
  date: string;
  splitStatus: string;
}

export interface Booking {
  bookingId: string;
  studentId: string;
  coachId: string;
  sessionType: string;
  dateTime: string;
  duration: number;
  status: string;
  calendarEventId: string;
  meetLink: string;
  paymentId: string;
  source: string;
  createdDate: string;
}

class GoogleSheetsDB {
  private sheets: any = null;

  private async getSheets() {
    if (!this.sheets) {
      this.sheets = getSheetsClient();
    }
    return this.sheets;
  }

  /**
   * Read data from a sheet
   */
  async read(sheetName: string, range: string): Promise<any[][]> {
    try {
      const sheets = await this.getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!${range}`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error reading from ${sheetName}:`, error);
      throw error;
    }
  }

  /**
   * Append data to a sheet
   */
  async append(sheetName: string, values: any[][]): Promise<void> {
    try {
      const sheets = await this.getSheets();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    } catch (error) {
      console.error(`Error appending to ${sheetName}:`, error);
      throw error;
    }
  }

  /**
   * Update a specific range
   */
  async update(sheetName: string, range: string, values: any[][]): Promise<void> {
    try {
      const sheets = await this.getSheets();
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!${range}`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    } catch (error) {
      console.error(`Error updating ${sheetName}:`, error);
      throw error;
    }
  }

  // ===================
  // COACH OPERATIONS
  // ===================

  async getAllCoaches(): Promise<Coach[]> {
    const rows = await this.read(SHEETS.COACHES, 'A2:M');
    return rows.map((row) => ({
      coachId: row[0] || '',
      name: row[1] || '',
      email: row[2] || '',
      phone: row[3] || '',
      specialization: row[4] || '',
      ageGroups: row[5] || '',
      availability: row[6] || '',
      status: row[7] || 'active',
      joinDate: row[8] || '',
      totalSessions: parseInt(row[9]) || 0,
      rating: parseFloat(row[10]) || 5.0,
      bankAccount: row[11] || '',
      subdomain: row[12] || '',
    }));
  }

  async getCoachBySubdomain(subdomain: string): Promise<Coach | null> {
    const coaches = await this.getAllCoaches();
    return coaches.find((c) => c.subdomain.toLowerCase() === subdomain.toLowerCase()) || null;
  }

  async getCoachById(coachId: string): Promise<Coach | null> {
    const coaches = await this.getAllCoaches();
    return coaches.find((c) => c.coachId === coachId) || null;
  }

  // ===================
  // PARENT OPERATIONS
  // ===================

  async getParentByEmail(email: string): Promise<Parent | null> {
    const rows = await this.read(SHEETS.PARENTS, 'A2:I');
    const parent = rows.find((row) => row[2]?.toLowerCase() === email.toLowerCase());
    if (!parent) return null;

    return {
      parentId: parent[0],
      name: parent[1],
      email: parent[2],
      phone: parent[3],
      children: parent[4] || '[]',
      coachingClient: parent[5] === 'TRUE',
      servicesAccess: parent[6] || 'PAID_PER_SERVICE',
      totalSpent: parseFloat(parent[7]) || 0,
      joinDate: parent[8],
    };
  }

  async createParent(data: {
    name: string;
    email: string;
    phone: string;
  }): Promise<Parent> {
    const parentId = generateId('par');
    const newParent: Parent = {
      parentId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      children: '[]',
      coachingClient: false,
      servicesAccess: 'PAID_PER_SERVICE',
      totalSpent: 0,
      joinDate: new Date().toISOString(),
    };

    await this.append(SHEETS.PARENTS, [[
      newParent.parentId,
      newParent.name,
      newParent.email,
      newParent.phone,
      newParent.children,
      'FALSE',
      newParent.servicesAccess,
      0,
      newParent.joinDate,
    ]]);

    return newParent;
  }

  async updateParentCoachingStatus(parentId: string, isCoachingClient: boolean): Promise<void> {
    const rows = await this.read(SHEETS.PARENTS, 'A2:A');
    const rowIndex = rows.findIndex((row) => row[0] === parentId);
    if (rowIndex === -1) return;

    const actualRow = rowIndex + 2; // +2 because we start from A2
    await this.update(SHEETS.PARENTS, `F${actualRow}:G${actualRow}`, [
      [isCoachingClient ? 'TRUE' : 'FALSE', isCoachingClient ? 'ALL_FREE' : 'PAID_PER_SERVICE'],
    ]);
  }

  // ===================
  // STUDENT OPERATIONS
  // ===================

  async createStudent(data: {
    childName: string;
    age: number;
    parentId: string;
    coachId: string;
    source: string;
    assignmentType: string;
    referralCoach?: string;
  }): Promise<Student> {
    const studentId = generateId('std');
    const newStudent: Student = {
      studentId,
      childName: data.childName,
      age: data.age,
      parentId: data.parentId,
      coachId: data.coachId,
      source: data.source,
      assignmentType: data.assignmentType,
      referralCoach: data.referralCoach || '',
      status: 'active',
      createdDate: new Date().toISOString(),
    };

    await this.append(SHEETS.STUDENTS, [[
      newStudent.studentId,
      newStudent.childName,
      newStudent.age,
      newStudent.parentId,
      newStudent.coachId,
      newStudent.source,
      newStudent.assignmentType,
      newStudent.referralCoach,
      newStudent.status,
      newStudent.createdDate,
    ]]);

    return newStudent;
  }

  async getStudentsByCoach(coachId: string): Promise<Student[]> {
    const rows = await this.read(SHEETS.STUDENTS, 'A2:J');
    return rows
      .filter((row) => row[4] === coachId && row[8] === 'active')
      .map((row) => ({
        studentId: row[0],
        childName: row[1],
        age: parseInt(row[2]),
        parentId: row[3],
        coachId: row[4],
        source: row[5],
        assignmentType: row[6],
        referralCoach: row[7],
        status: row[8],
        createdDate: row[9],
      }));
  }

  async getStudentById(studentId: string): Promise<Student | null> {
    const rows = await this.read(SHEETS.STUDENTS, 'A2:J');
    const student = rows.find((row) => row[0] === studentId);
    if (!student) return null;

    return {
      studentId: student[0],
      childName: student[1],
      age: parseInt(student[2]),
      parentId: student[3],
      coachId: student[4],
      source: student[5],
      assignmentType: student[6],
      referralCoach: student[7],
      status: student[8],
      createdDate: student[9],
    };
  }

  // ===================
  // ASSESSMENT OPERATIONS
  // ===================

  async createAssessment(data: {
    studentId: string;
    coachId: string;
    score: number;
    wpm: number;
    fluency: string;
    pronunciation: string;
    passage: string;
    recordingUrl?: string;
    geminiAnalysis: object;
    source: string;
    assignedToCoach?: boolean;
  }): Promise<Assessment> {
    const assessmentId = generateId('asmt');
    const newAssessment: Assessment = {
      assessmentId,
      studentId: data.studentId,
      coachId: data.coachId,
      date: new Date().toISOString(),
      score: data.score,
      wpm: data.wpm,
      fluency: data.fluency,
      pronunciation: data.pronunciation,
      passage: data.passage,
      recordingUrl: data.recordingUrl || '',
      geminiAnalysis: JSON.stringify(data.geminiAnalysis),
      assignedToCoach: data.assignedToCoach ? 'YES' : 'NO',
      source: data.source,
    };

    await this.append(SHEETS.ASSESSMENTS, [[
      newAssessment.assessmentId,
      newAssessment.studentId,
      newAssessment.coachId,
      newAssessment.date,
      newAssessment.score,
      newAssessment.wpm,
      newAssessment.fluency,
      newAssessment.pronunciation,
      newAssessment.passage,
      newAssessment.recordingUrl,
      newAssessment.geminiAnalysis,
      newAssessment.assignedToCoach,
      newAssessment.source,
    ]]);

    return newAssessment;
  }

  async getAssessmentById(assessmentId: string): Promise<Assessment | null> {
    const rows = await this.read(SHEETS.ASSESSMENTS, 'A2:M');
    const assessment = rows.find((row) => row[0] === assessmentId);
    if (!assessment) return null;

    return {
      assessmentId: assessment[0],
      studentId: assessment[1],
      coachId: assessment[2],
      date: assessment[3],
      score: parseInt(assessment[4]),
      wpm: parseInt(assessment[5]),
      fluency: assessment[6],
      pronunciation: assessment[7],
      passage: assessment[8],
      recordingUrl: assessment[9],
      geminiAnalysis: assessment[10],
      assignedToCoach: assessment[11],
      source: assessment[12],
    };
  }

  async getPendingAssignments(): Promise<Assessment[]> {
    const rows = await this.read(SHEETS.ASSESSMENTS, 'A2:M');
    return rows
      .filter((row) => row[11] === 'NO')
      .map((row) => ({
        assessmentId: row[0],
        studentId: row[1],
        coachId: row[2],
        date: row[3],
        score: parseInt(row[4]),
        wpm: parseInt(row[5]),
        fluency: row[6],
        pronunciation: row[7],
        passage: row[8],
        recordingUrl: row[9],
        geminiAnalysis: row[10],
        assignedToCoach: row[11],
        source: row[12],
      }));
  }

  // ===================
  // PAYMENT OPERATIONS
  // ===================

  async createPayment(data: {
    studentId: string;
    coachId: string;
    amount: number;
    coachShare: number;
    yestorydShare: number;
    source: string;
    referralCoach?: string;
    assignedBy: string;
    packageType: string;
    razorpayPaymentId: string;
  }): Promise<Payment> {
    const paymentId = generateId('pay');
    const newPayment: Payment = {
      paymentId,
      studentId: data.studentId,
      coachId: data.coachId,
      amount: data.amount,
      coachShare: data.coachShare,
      yestorydShare: data.yestorydShare,
      source: data.source,
      referralCoach: data.referralCoach || '',
      assignedBy: data.assignedBy,
      packageType: data.packageType,
      razorpayPaymentId: data.razorpayPaymentId,
      status: 'captured',
      date: new Date().toISOString(),
      splitStatus: 'pending',
    };

    await this.append(SHEETS.PAYMENTS, [[
      newPayment.paymentId,
      newPayment.studentId,
      newPayment.coachId,
      newPayment.amount,
      newPayment.coachShare,
      newPayment.yestorydShare,
      newPayment.source,
      newPayment.referralCoach,
      newPayment.assignedBy,
      newPayment.packageType,
      newPayment.razorpayPaymentId,
      newPayment.status,
      newPayment.date,
      newPayment.splitStatus,
    ]]);

    return newPayment;
  }

  async getCoachRevenue(coachId: string, month?: string): Promise<{
    payments: Payment[];
    totalAmount: number;
    totalCoachShare: number;
  }> {
    const rows = await this.read(SHEETS.PAYMENTS, 'A2:N');
    let payments = rows
      .filter((row) => row[2] === coachId && row[11] === 'captured')
      .map((row) => ({
        paymentId: row[0],
        studentId: row[1],
        coachId: row[2],
        amount: parseFloat(row[3]),
        coachShare: parseFloat(row[4]),
        yestorydShare: parseFloat(row[5]),
        source: row[6],
        referralCoach: row[7],
        assignedBy: row[8],
        packageType: row[9],
        razorpayPaymentId: row[10],
        status: row[11],
        date: row[12],
        splitStatus: row[13],
      }));

    if (month) {
      payments = payments.filter((p) => p.date.startsWith(month));
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCoachShare = payments.reduce((sum, p) => sum + p.coachShare, 0);

    return { payments, totalAmount, totalCoachShare };
  }

  // ===================
  // BOOKING OPERATIONS
  // ===================

  async createBooking(data: {
    studentId: string;
    coachId: string;
    sessionType: string;
    dateTime: string;
    duration: number;
    calendarEventId?: string;
    meetLink?: string;
    paymentId?: string;
    source: string;
  }): Promise<Booking> {
    const bookingId = generateId('bk');
    const newBooking: Booking = {
      bookingId,
      studentId: data.studentId,
      coachId: data.coachId,
      sessionType: data.sessionType,
      dateTime: data.dateTime,
      duration: data.duration,
      status: 'confirmed',
      calendarEventId: data.calendarEventId || '',
      meetLink: data.meetLink || '',
      paymentId: data.paymentId || '',
      source: data.source,
      createdDate: new Date().toISOString(),
    };

    await this.append(SHEETS.BOOKINGS, [[
      newBooking.bookingId,
      newBooking.studentId,
      newBooking.coachId,
      newBooking.sessionType,
      newBooking.dateTime,
      newBooking.duration,
      newBooking.status,
      newBooking.calendarEventId,
      newBooking.meetLink,
      newBooking.paymentId,
      newBooking.source,
      newBooking.createdDate,
    ]]);

    return newBooking;
  }

  async getCoachBookings(coachId: string): Promise<Booking[]> {
    const rows = await this.read(SHEETS.BOOKINGS, 'A2:L');
    return rows
      .filter((row) => row[2] === coachId)
      .map((row) => ({
        bookingId: row[0],
        studentId: row[1],
        coachId: row[2],
        sessionType: row[3],
        dateTime: row[4],
        duration: parseInt(row[5]),
        status: row[6],
        calendarEventId: row[7],
        meetLink: row[8],
        paymentId: row[9],
        source: row[10],
        createdDate: row[11],
      }));
  }
}

// Export singleton instance
export const sheetsDB = new GoogleSheetsDB();
