export async function validateToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === process.env.JOURNAL_SECRET
  }

  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      return body?.token === process.env.JOURNAL_SECRET
    }
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      return form.get('token') === process.env.JOURNAL_SECRET
    }
  } catch {
    return false
  }

  return false
}
