const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://umvjzgurzkldqyxzkkaq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_nl3_LnjtU7n_llqZBp7BNQ_SQWFegdj';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  // We can't easily query information_schema via supabase-js directly unless we use rpc or just try to insert duplicate.
  // Let's try to insert a duplicate and see the error.
  
  const testDate = '2030-01-01';
  // First insert
  const { data: d1, error: e1 } = await supabase.from('shifts').insert({
      nurse_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID, likely to fail FK if constraints exist
      date: testDate,
      type: 'day'
  });
  
  if (e1 && e1.message.includes('foreign key')) {
      console.log('FK Check passed (expected). Now testing unique constraint.');
      // We need a valid nurse_id to test unique constraint properly.
      // Let's fetch one.
      const { data: nurses } = await supabase.from('nurses').select('id').limit(1);
      if (!nurses || nurses.length === 0) {
          console.log('No nurses found to test.');
          return;
      }
      const nurseId = nurses[0].id;
      
      console.log('Testing with nurse:', nurseId);
      
      // Clean up first
      await supabase.from('shifts').delete().eq('nurse_id', nurseId).eq('date', testDate);
      
      // Insert 1
      const { error: i1 } = await supabase.from('shifts').insert({
          nurse_id: nurseId,
          date: testDate,
          type: 'day'
          // roster_id null
      });
      
      if (i1) {
          console.log('Insert 1 failed:', i1.message);
          return;
      }
      
      // Insert 2 (Same nurse, same date, different roster_id - simulating the issue)
      // Note: We need a valid roster_id for FK if roster_id column has FK.
      // But we can try null again? No, duplicate nulls might be allowed depending on constraint.
      // Let's try inserting another one with null roster_id first.
      
      const { error: i2 } = await supabase.from('shifts').insert({
          nurse_id: nurseId,
          date: testDate,
          type: 'night'
          // roster_id null
      });
      
      if (i2) {
          console.log('Insert 2 (Duplicate NULL roster) failed:', i2.message);
          console.log('CONSTRAINT_DETECTED: Likely (nurse_id, date)');
      } else {
          console.log('Insert 2 (Duplicate NULL roster) succeeded.');
          console.log('CONSTRAINT_ABSENT: (nurse_id, date) is NOT unique.');
      }
      
      // Clean up
      await supabase.from('shifts').delete().eq('nurse_id', nurseId).eq('date', testDate);
  } else {
      console.log('Initial Insert Error:', e1 ? e1.message : 'Success?');
  }
}

checkConstraints();
