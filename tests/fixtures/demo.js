// Synthetic data for automated tests only; excluded from the extension build.
export function demoConversation(){
  return {schemaVersion:1,title:'A little room for big ideas',platform:'chatgpt',model:'Fixture model',effort:'High (synthetic test)',sourceUrl:'https://example.com/synthetic-chat',exportedAt:'2026-09-15T09:00:00.000Z',completeness:'synthetic',
    messages:[
      {id:'demo-1',role:'user',blocks:[{type:'paragraph',text:'Help me plan a small balcony garden. I have morning sunlight and a few spare pots.'}]},
      {id:'demo-2',role:'assistant',blocks:[{type:'heading',level:2,text:'Start small. Grow something good.'},{type:'paragraph',text:'Choose plants that fit your light, then give each one room to settle in.'},{type:'table',rows:[['Plant','Light','Water'],['Basil','Morning sun','When the soil feels dry'],['Mint','Partial shade','Keep lightly moist']]},{type:'list',ordered:true,items:['Choose pots with drainage.','Add fresh potting mix.','Check the soil each morning.']}]},
      {id:'demo-3',role:'user',blocks:[{type:'paragraph',text:'Can I keep a tiny watering log? And a multilingual label: നമസ്കാരം · வணக்கம் · नमस्ते 🌱'}]},
      {id:'demo-4',role:'assistant',blocks:[{type:'paragraph',text:'A simple record is enough. Keep the habit small and consistent.'},{type:'code',language:'javascript',text:"const garden = [{ plant: 'Basil', watered: false }];\nconsole.table(garden);"}]}
    ]};
}
