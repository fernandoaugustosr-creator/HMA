import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

interface DB {
  nurses: any[]
  shifts: any[]
  time_off_requests: any[]
  schedule_sections: any[]
  units: any[]
}

const INITIAL_DB: DB = {
  nurses: [
    { id: 'mock-1', name: 'Maria Silva (Local)', cpf: '111.111.111-11', role: 'ENFERMEIRO', section_id: 'sec-1', unit_id: 'unit-1', password: '123' },
    { id: 'mock-2', name: 'João Santos (Local)', cpf: '222.222.222-22', role: 'TECNICO', section_id: 'sec-2', unit_id: 'unit-1', password: '123' },
    { id: 'mock-3', name: 'Administrador', cpf: '02170025367', role: 'ENFERMEIRO', section_id: 'sec-1', unit_id: 'unit-1', password: '123456' }
  ],
  shifts: [],
  time_off_requests: [],
  schedule_sections: [
    { id: 'sec-1', title: 'ENFERMEIROS', position: 1 },
    { id: 'sec-2', title: 'TÉCNICOS DE ENFERMAGEM', position: 2 }
  ],
  units: [
    { id: 'unit-1', title: 'POSTO 1' },
    { id: 'unit-2', title: 'POSTO 2' }
  ]
}

export function readDb(): DB {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(INITIAL_DB)
      return INITIAL_DB
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    // Ensure all fields exist
    return { ...INITIAL_DB, ...parsed }
  } catch (error) {
    console.error('Error reading DB:', error)
    return INITIAL_DB
  }
}

export function writeDb(data: DB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error writing DB:', error)
  }
}
