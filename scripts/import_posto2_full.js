
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SECTIONS = {
    ENFERMEIROS: '21d3a998-0cb0-4b95-8985-eebd31f712e4',
    TECNICOS: '041dabc7-6a55-405f-a2ee-72bc5b5a9c90'
};

const DATA = {
    unitName: 'POSTO 2',
    year: 2026,
    month: 2, // February
    
    nurses: [
        {
            name: 'LEYDIANY CARVALHO BOMJARDIM OLIVEIRA',
            role: 'ENFERMEIRO',
            bond: 'ESCALA DUPLA',
            shifts: [1, 'N', 6, 'D', 7, 'N', 12, 'D', 13, 'N', 18, 'D', 19, 'N', 24, 'D', 25, 'N']
        },
        {
            name: 'NAYRA MARTINS NEIVA',
            role: 'ENFERMEIRO',
            bond: 'CONCURSO',
            shifts: [1, 'D', 2, 'N', 7, 'D', 8, 'N', 13, 'D', 14, 'N', 19, 'D', 20, 'N', 25, 'D', 26, 'N']
        },
        {
            name: 'DEMETRIUS COSTA COELHO',
            role: 'ENFERMEIRO',
            bond: 'CONCURSO',
            shifts: [2, 'D', 3, 'N', 8, 'D', 9, 'N', 14, 'D', 15, 'N', 20, 'D', 21, 'N', 26, 'D', 27, 'N']
        },
        {
            name: 'KEURY PINHO CONCEIÇÃO SEL',
            role: 'ENFERMEIRO',
            bond: 'SELETIVO',
            shifts: [3, 'D', 4, 'N', 9, 'D', 10, 'N']
        },
        {
            name: 'ESCALA DESCOBERTA', 
            role: 'ENFERMEIRO',
            bond: 'ESCALA', 
            shifts: [15, 'D', 16, 'N', 21, 'D', 22, 'N', 27, 'D', 28, 'N']
        },
        {
            name: 'HEIDER CUNHA BARROS',
            role: 'ENFERMEIRO',
            bond: 'CONCURSO',
            shifts: [4, 'D', 5, 'N', 10, 'D', 11, 'N', 16, 'D', 17, 'N', 22, 'D', 23, 'N', 28, 'D']
        },
        {
            name: 'INGRID NOLETO TEIXEIRA',
            role: 'ENFERMEIRO',
            bond: 'CONCURSO',
            shifts: [5, 'D', 6, 'N', 11, 'D', 12, 'N', 17, 'D', 18, 'N', 23, 'D', 24, 'N']
        }
    ],
    technicians: [
        {
            name: 'ESCALA DESCOBERTA',
            role: 'TECNICO',
            bond: 'ESCALA',
            shifts: [1, 'N', 6, 'D', 7, 'N', 12, 'D', 13, 'N', 18, 'D', 19, 'N', 24, 'D', 25, 'N']
        },
        {
            name: 'ODINETE NASCIMENTO ARAÚJO',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [1, 'N', 6, 'D', 7, 'N', 12, 'D', 13, 'N', 18, 'D', 19, 'N', 24, 'D', 25, 'N']
        },
        {
            name: 'DAYS FERNANDA SILVA DE JESUS SEL',
            role: 'TECNICO',
            bond: 'SELETIVO',
            shifts: [1, 'N', 6, 'D', 7, 'N']
        },
        {
            name: 'SOLANGE FRANCISCA PEREIRA DA SILVA',
            role: 'TECNICO',
            bond: 'SELETIVO',
            shifts: [1, 'N', 6, 'D', 7, 'N']
        },
        {
            name: 'SOLANGE FRANCISCA PEREIRA DA SILVA 1ED',
            role: 'TECNICO',
            bond: 'ESCALA',
            shifts: [12, 'D', 13, 'N', 18, 'D', 19, 'N', 24, 'D', 25, 'N']
        },
        {
            name: 'JOSEANA FERNANDES DOS SANTOS',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [1, 'D', 2, 'N', 7, 'D', 8, 'N', 13, 'D', 14, 'N', 19, 'D', 20, 'N', 25, 'D', 26, 'N']
        },
        {
            name: 'CHEILA FERREIRA ABREU*',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [1, 'D', 2, 'N', 7, 'D', 8, 'N', 13, 'D', 14, 'N', 19, 'D', 20, 'N', 25, 'D', 26, 'N']
        },
        {
            name: 'MARIA DE JESUS FONTINELLE DOS SANTOS LEAL ED',
            role: 'TECNICO',
            bond: 'ESCALA',
            shifts: [1, 'D', 2, 'N', 7, 'D', 8, 'N', 13, 'D', 14, 'N', 19, 'D', 20, 'N', 25, 'D', 26, 'N']
        },
        {
            name: 'MARIA DE JESUS FONTINELLE DOS SANTOS LEAL',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [2, 'D', 3, 'N', 8, 'D', 9, 'N', 14, 'D', 15, 'N', 20, 'D', 21, 'N', 26, 'D', 27, 'N']
        },
        {
            name: 'IACI SOUSA LIMA DA SILVA',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [2, 'D', 3, 'N', 8, 'D', 9, 'N', 14, 'D', 15, 'N', 20, 'D', 21, 'N', 26, 'D', 27, 'N']
        },
        {
            name: 'ESCALA DESCOBERTA', 
            role: 'TECNICO',
            bond: 'ESCALA',
            shifts: [2, 'D', 3, 'N', 8, 'D', 9, 'N', 14, 'D', 15, 'N', 20, 'D', 21, 'N', 26, 'D', 27, 'N']
        },
        {
            name: 'JOSEANA FERNANDES DOS SANTOS',
            role: 'TECNICO',
            bond: 'SELETIVO',
            shifts: [3, 'D', 4, 'N', 9, 'D', 10, 'N']
        },
        {
            name: 'JOSEANA FERNANDES DOS SANTOS 1ED',
            role: 'TECNICO',
            bond: 'ESCALA',
            shifts: [15, 'D', 16, 'N', 21, 'D', 22, 'N', 27, 'D', 28, 'N']
        },
        {
            name: 'ALDEMARES MARIA OLIVEIRA DA SILVA SEL',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [3, 'D', 4, 'N', 9, 'D', 10, 'N', 15, 'D', 16, 'N', 21, 'D', 22, 'N', 27, 'D', 28, 'N']
        },
        {
            name: 'ZORMANIA GONÇALVES PAZ',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [3, 'D', 4, 'N', 9, 'D', 10, 'N', 15, 'D', 16, 'N', 21, 'D', 22, 'N', 27, 'D', 28, 'N']
        },
        {
            name: 'DEBORA MARIA DE OLIVEIRA SILVA SEL',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [4, 'D', 5, 'N', 10, 'D', 11, 'N']
        },
        {
            name: 'DEBORA MARIA DE OLIVEIRA SILVA 1ED',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [16, 'D', 17, 'N', 22, 'D', 23, 'N', 27, 'D', 28, 'N']
        },
        {
            name: 'CHYRLALYA RAUL ALMEIDA CARVALHO',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [4, 'D', 5, 'N', 10, 'D', 11, 'N', 16, 'D', 17, 'N', 22, 'D', 23, 'N', 28, 'D']
        },
        {
            name: 'DINAIR FERREIRA MIRANDA SEL',
            role: 'TECNICO',
            bond: 'SELETIVO',
            shifts: [4, 'D', 5, 'N', 10, 'D', 11, 'N']
        },
        {
            name: 'DINAIR FERREIRA MIRANDA 1ED',
            role: 'TECNICO',
            bond: 'SELETIVO',
            shifts: [17, 'D', 18, 'N', 23, 'D', 24, 'N', 28, 'D']
        },
        {
            name: 'FRANCISCA CLERISMAR DA SILVA',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [5, 'D', 6, 'N', 11, 'D', 12, 'N', 17, 'D', 18, 'N', 23, 'D', 24, 'N']
        },
        {
            name: 'LIDIONEZA ALVES PEREIRA',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [5, 'D', 6, 'N', 11, 'D', 12, 'N', 17, 'D', 18, 'N', 23, 'D', 24, 'N']
        },
        {
            name: 'WALCIRENE PEREIRA DI REIS',
            role: 'TECNICO',
            bond: 'CONCURSO',
            shifts: [5, 'D', 6, 'N', 11, 'D', 12, 'N', 17, 'D', 18, 'N', 23, 'D', 24, 'N']
        }
    ]
};

function generateCPF() {
    // Generate valid-ish 11 digit CPF (random)
    let cpf = '';
    for(let i=0; i<11; i++) cpf += Math.floor(Math.random()*10);
    return cpf;
}

async function main() {
    console.log('Starting Full Import for POSTO 2 - February 2026...');

    // 1. Get/Create Unit
    let { data: unit } = await supabase.from('units').select('id').eq('title', DATA.unitName).single();
    if (!unit) {
        console.log('Creating Unit:', DATA.unitName);
        const { data: newUnit, error } = await supabase.from('units').insert({ title: DATA.unitName }).select().single();
        if (error) throw error;
        unit = newUnit;
    }
    console.log('Unit ID:', unit.id);

    // 2. Prepare Roster Map (monthly_rosters)
    // We need to fetch rosters for this Unit, Month, Year
    const { data: existingRoster } = await supabase
        .from('monthly_rosters')
        .select('id, nurse_id, section_id')
        .eq('unit_id', unit.id)
        .eq('month', DATA.month)
        .eq('year', DATA.year);
        
    const rosterMap = {}; // nurse_id -> [id1, id2...]
    if (existingRoster) {
        existingRoster.forEach(r => {
            if (!rosterMap[r.nurse_id]) rosterMap[r.nurse_id] = [];
            rosterMap[r.nurse_id].push(r.id);
        });
    }

    const allPros = [...DATA.nurses, ...DATA.technicians];
    
    for (const pro of allPros) {
        console.log(`Processing ${pro.name}...`);
        
        // 3. Get/Create Nurse
        let { data: nurse } = await supabase.from('nurses').select('id').eq('name', pro.name).single();
        if (!nurse) {
            console.log('Creating Nurse:', pro.name);
            const { data: newNurse, error } = await supabase.from('nurses').insert({ 
                name: pro.name, 
                role: pro.role,
                vinculo: pro.bond,
                cpf: generateCPF() // Add dummy CPF
            }).select().single();
            if (error) {
                console.error('Error creating nurse:', error.message);
                continue;
            }
            nurse = newNurse;
        }
        
        // 4. Get/Create Roster Entry (monthly_rosters)
        let rosterId;
        const sectionId = pro.role === 'ENFERMEIRO' ? SECTIONS.ENFERMEIROS : SECTIONS.TECNICOS;
        
        if (rosterMap[nurse.id] && rosterMap[nurse.id].length > 0) {
            rosterId = rosterMap[nurse.id].shift();
            console.log('  Using existing roster:', rosterId);
        } else {
            const { data: newRoster, error } = await supabase
                .from('monthly_rosters')
                .insert({ 
                    nurse_id: nurse.id, 
                    unit_id: unit.id,
                    section_id: sectionId,
                    month: DATA.month,
                    year: DATA.year
                })
                .select()
                .single();
            if (error) {
                console.error('Error creating roster:', error.message);
                continue;
            }
            rosterId = newRoster.id;
            console.log('  Created new roster:', rosterId);
        }
        
        // 5. Clear Feb Shifts (for this roster_id)
        await supabase
            .from('shifts')
            .delete()
            .eq('roster_id', rosterId)
            .gte('date', '2026-02-01')
            .lte('date', '2026-02-28');
            
        // 6. Insert Shifts
        const shiftsToInsert = [];
        for (let i = 0; i < pro.shifts.length; i += 2) {
            const day = pro.shifts[i];
            const typeKey = pro.shifts[i+1];
            
            const dayStr = day.toString().padStart(2, '0');
            const date = `2026-02-${dayStr}`;
            const type = typeKey === 'D' ? 'day' : 'night';
            
            shiftsToInsert.push({
                roster_id: rosterId,
                nurse_id: nurse.id,
                date: date,
                type: type
            });
        }
        
        if (shiftsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('shifts').insert(shiftsToInsert);
            if (insertError) console.error('  Error inserting shifts:', insertError.message);
            else console.log(`  Inserted ${shiftsToInsert.length} shifts.`);
        }
    }
    
    console.log('Import Completed.');
}

main().catch(console.error);
