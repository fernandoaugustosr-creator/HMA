
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found at', dbPath);
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // 1. Migrate Units
  if (db.units && db.units.length > 0) {
    console.log(`Upserting ${db.units.length} units...`);
    const { error } = await supabase.from('units').upsert(db.units.map(u => ({
        id: u.id,
        title: u.title
    })));
    if (error) console.error('Error upserting units:', error);
  }

  // 2. Migrate Schedule Sections
  if (db.schedule_sections && db.schedule_sections.length > 0) {
    console.log(`Upserting ${db.schedule_sections.length} sections...`);
    const { error } = await supabase.from('schedule_sections').upsert(db.schedule_sections.map(s => ({
        id: s.id,
        title: s.title,
        position: s.position
    })));
    if (error) console.error('Error upserting sections:', error);
  }

  // 3. Migrate Nurses
  if (db.nurses && db.nurses.length > 0) {
    console.log(`Upserting ${db.nurses.length} nurses...`);
    // Filter out mock admin if it has no CPF or invalid CPF
    const validNurses = db.nurses.map(n => ({
        id: n.id === 'mock-admin' ? '00000000-0000-0000-0000-000000000001' : n.id,
        name: n.name,
        cpf: n.cpf || '00000000000',
        password: n.password || '123456',
        coren: n.coren,
        vinculo: n.vinculo,
        role: n.role || 'ENFERMEIRO',
        section_id: n.section_id === 'sec-enfermeiros' ? null : n.section_id, // Fix mock IDs if needed
        unit_id: n.unit_id === 'unit-1' ? null : n.unit_id
    }));
    
    const { error } = await supabase.from('nurses').upsert(validNurses);
    if (error) console.error('Error upserting nurses:', error);
  }

  // 4. Migrate Monthly Rosters
  if (db.monthly_rosters && db.monthly_rosters.length > 0) {
    console.log(`Upserting ${db.monthly_rosters.length} rosters...`);
    const validRosters = db.monthly_rosters.map(r => ({
        id: r.id,
        nurse_id: r.nurse_id,
        section_id: r.section_id,
        unit_id: r.unit_id,
        month: r.month,
        year: r.year,
        created_at: r.created_at
    }));
    const { error } = await supabase.from('monthly_rosters').upsert(validRosters);
    if (error) console.error('Error upserting rosters:', error);
  }

  // 5. Migrate Shifts
  if (db.shifts && db.shifts.length > 0) {
    console.log(`Upserting ${db.shifts.length} shifts...`);
    const { error } = await supabase.from('shifts').upsert(db.shifts.map(s => ({
        id: s.id,
        nurse_id: s.nurse_id,
        date: s.shift_date || s.date,
        type: s.shift_type || s.type,
        created_at: s.created_at
    })));
    if (error) console.error('Error upserting shifts:', error);
  }

  // 6. Migrate Time Off Requests
  if (db.time_off_requests && db.time_off_requests.length > 0) {
    console.log(`Upserting ${db.time_off_requests.length} time off requests...`);
    const { error } = await supabase.from('time_off_requests').upsert(db.time_off_requests.map(t => ({
        id: t.id,
        nurse_id: t.nurse_id,
        start_date: t.start_date,
        end_date: t.end_date,
        type: t.type,
        status: t.status,
        created_at: t.created_at
    })));
    if (error) console.error('Error upserting time off requests:', error);
  }

  // 7. Migrate Absences (check if table exists)
  if (db.absences && db.absences.length > 0) {
      console.log(`Upserting ${db.absences.length} absences...`);
      // Since 'absences' might not be in the initial schema I read, 
      // I'll check if I can insert it.
      const { error } = await supabase.from('absences').upsert(db.absences.map(a => ({
          id: a.id,
          nurse_id: a.nurse_id,
          date: a.date,
          reason: a.reason,
          created_at: a.created_at
      })));
      if (error) console.log('Absences table might not exist or error:', error.message);
  }

  console.log('Migration finished!');
}

migrate();
