import "dotenv/config"

export const PORT = 3000

export const mongoDbUrl = process.env.DB_URL

export const secret = process.env.SECRET || 'secret!'

