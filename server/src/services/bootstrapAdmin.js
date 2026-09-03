const MIN_PASSWORD_LENGTH = 12

export function validateBootstrapInput(input) {
  const companyName = String(input.companyName ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const name = String(input.name ?? '').trim()
  const password = String(input.password ?? '')

  if (!companyName) throw new Error('BOOTSTRAP_COMPANY_NAME is required')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address')
  }
  if (!name) throw new Error('BOOTSTRAP_ADMIN_NAME is required')
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  return { companyName, email, name, password }
}

export async function bootstrapAdmin(prisma, input, hashPassword) {
  const values = validateBootstrapInput(input)
  const passwordHash = await hashPassword(values.password)

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: values.email },
      include: {
        company: { select: { name: true } },
        rbacRole: { select: { isAdmin: true } },
      },
    })

    if (existingUser) {
      if (existingUser.company?.name === values.companyName && existingUser.rbacRole?.isAdmin) {
        return {
          created: false,
          companyId: existingUser.companyId,
          userId: existingUser.id,
          email: existingUser.email,
        }
      }
      throw new Error('The requested email already belongs to a different or non-admin account')
    }

    // companies.name 沒有 unique 約束，findFirst 可能命中另一個同名租戶。
    // 只有「這次新建的公司」或「完全沒有使用者的公司」才可以接上 bootstrap 管理員，
    // 否則同名或打錯字就會把管理權授予別的租戶的出勤與薪資資料。
    let company = await tx.company.findFirst({ where: { name: values.companyName } })
    const companyExisted = Boolean(company)
    if (!company) company = await tx.company.create({ data: { name: values.companyName } })

    let adminRole = await tx.role.findFirst({
      where: { companyId: company.id, isAdmin: true },
      include: { members: { where: { deletedAt: null }, select: { email: true }, take: 1 } },
    })

    if (adminRole?.members.length) {
      throw new Error(`Company already has an administrator (${adminRole.members[0].email})`)
    }

    if (companyExisted) {
      const userCount = await tx.user.count({ where: { companyId: company.id } })
      if (userCount > 0) {
        throw new Error(
          `A different company named "${values.companyName}" already exists with ${userCount} user(s). `
          + 'Bootstrap only creates the first administrator of a new company. '
          + 'Use a distinct BOOTSTRAP_COMPANY_NAME, or promote an existing user instead.',
        )
      }
    }
    if (!adminRole) {
      adminRole = await tx.role.create({
        data: {
          companyId: company.id,
          departmentId: null,
          name: 'Admin',
          isAdmin: true,
          permissions: [],
        },
      })
    }

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        roleId: adminRole.id,
        email: values.email,
        name: values.name,
        password: passwordHash,
        timezone: 'Asia/Taipei',
      },
    })

    return {
      created: true,
      companyId: company.id,
      userId: user.id,
      email: user.email,
    }
  }, { isolationLevel: 'Serializable' })
}

export { MIN_PASSWORD_LENGTH }
