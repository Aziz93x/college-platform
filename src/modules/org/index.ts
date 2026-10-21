export {
  collegeInput,
  type DepartmentInput,
  departmentInput,
} from "./domain/inputs.ts";
export {
  createDepartment,
  type Department,
  findDepartment,
  listDepartments,
  updateCollege,
  updateDepartment,
} from "./server/departments.ts";
export { findCollege, findCollegeId } from "./server/find-college.ts";
export {
  colleges,
  departmentRayatValues,
  departments,
} from "./server/schema.ts";
