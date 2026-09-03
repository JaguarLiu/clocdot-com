// 使用者對外 DTO — 所有「回給前端」的 user 物件都過這支
// 新增欄位 *不會* 被預設拋出，除非明確加到這裡
export function toUserDto(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatar: user.avatar ?? null,
    empNo: user.empNo ?? null,
    employmentType: user.employmentType ?? 'regular',
  }
}
