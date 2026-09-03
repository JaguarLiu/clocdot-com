import { body, str, strOrNull, bool, int, anyArray } from '../../utils/schema.js'

const intOrNull = { type: ['integer', 'null'] }
const roleIdType = { type: ['string', 'integer', 'null'] }
const numOrNull = { type: ['number', 'null'] }

// Top-level type guards shared by the admin route modules. Domain-specific
// validation intentionally remains in each handler.
export const adminSchemas = {
  attendancePatch: body({ isLate: bool, isEarlyLeave: bool, leaveType: strOrNull, isHoliday: bool }),
  correctionReview: body({ status: str }),
  leaveReview: body({ status: str, action: str, reviewNote: strOrNull }),
  overtimeReview: body({ status: str, confirm: bool }),
  companyPatch: body({
    name: str, breakMinutes: int, leavePolicyYearReset: str,
    onsiteCycleWeeks: int, onsiteWeekdaysByCycle: anyArray, onsiteMonthDays: anyArray,
    scheduleAnchorDate: strOrNull, flexibleOvertime: bool, workHourType: str, lateDeductMode: str,
    wifiCheckinEnabled: bool, allowedIps: anyArray,
  }),
  location: body({ name: str, address: str, radius: numOrNull }),
  userCreate: body({
    email: str, name: strOrNull, empNo: intOrNull, timezone: str, password: str,
    hireDate: strOrNull, departmentId: strOrNull, roleId: roleIdType, employmentType: str,
  }),
  userPatch: body({
    name: strOrNull, empNo: intOrNull, timezone: str, hireDate: strOrNull,
    departmentId: strOrNull, roleId: roleIdType, defaultShiftId: strOrNull, employmentType: str,
  }),
  userImport: body({ rows: anyArray }),
  department: body({ name: str, parentId: strOrNull, managerId: strOrNull }),
  roleCreate: body({ name: str, permissions: anyArray, isAdmin: bool }),
  rolePatch: body({ name: str, permissions: anyArray }),
  salaryProfile: { type: 'object', additionalProperties: true },
  payrollRunCreate: body({ month: str }),
  payrollCashout: body({ userIds: anyArray }),
  payrollItems: body({ adjustments: anyArray }),
  leavePolicies: body({ policies: anyArray }),
  passwordSet: body({ password: str }),
  issues: body({ title: str, type: str, description: str }),
}
