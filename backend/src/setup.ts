import { randomUUID } from 'node:crypto'
import { hashPassword } from './auth'
import { client, init, products, shops, users, type Member } from './db'

async function setup() {
  await init()
  const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_DATA, DEMO_PASSWORD } = process.env
  const productSeedOnly = process.env.DEMO_PRODUCTS === 'true'
  if (ADMIN_EMAIL || ADMIN_PASSWORD) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) throw new Error('Siapkan email admin dan kata sandi minimal 10 karakter.')
    if (!(await users.findOne({ email:ADMIN_EMAIL.toLowerCase() }))) {
      await users.insertOne({ _id:randomUUID(),name:'Admin Platform',email:ADMIN_EMAIL.toLowerCase(),password:await hashPassword(ADMIN_PASSWORD),platform_admin:true })
    }
  }
  const padang = process.env.PADANG_DEMO_DATA === 'true'
  if (DEMO_DATA !== 'true' && !padang && !productSeedOnly) return
  if (!productSeedOnly && (!DEMO_PASSWORD || DEMO_PASSWORD.length < 10)) throw new Error('Atur DEMO_PASSWORD minimal 10 karakter.')
  const password = productSeedOnly ? '' : await hashPassword(DEMO_PASSWORD!)
  const oldSamples = [
    ['1','Meja Reparasi Cikini','Jakarta','Menteng','Pemeriksaan dan perbaikan ponsel, dari baterai sampai konektor pengisian.','Raka','Servis HP','HP','Ganti baterai',180000],
    ['2','Bengkel Laptop Dago','Bandung','Coblong','Pembersihan internal dan diagnosis laptop.','Nisa','Servis laptop','Laptop','Pembersihan dan repasta',150000],
    ['3','Ruang Servis Tebet','Jakarta','Tebet','Diagnosis layar dan pengisian daya untuk ponsel serta laptop.','Dian','Servis HP dan laptop','HP','Diagnosis layar',75000],
  ] as const
  const padangSamples = [
    ['4','Bengkel Ponsel Padang Barat','Padang','Padang Barat','Pemeriksaan layar, baterai, dan pengisian daya ponsel.','Aldi (demo)','Servis HP','HP','Diagnosis ponsel',65000],
    ['5','Meja Laptop Kuranji','Padang','Kuranji','Pembersihan kipas, diagnosis panas berlebih, dan pemeriksaan laptop mati total.','Sari (demo)','Servis laptop','Laptop','Pembersihan dan repasta',150000],
    ['6','Ruang Reparasi Pauh','Padang','Pauh','Pemeriksaan port, penyimpanan, dan kinerja laptop.','Fikri (demo)','Servis laptop','Laptop','Diagnosis laptop',75000],
  ] as const
  const points:Record<string,[number,number]> = { '4':[100.355,-0.944], '5':[100.403,-0.914], '6':[100.454,-0.906] }
  const samples = productSeedOnly ? [] : [...(DEMO_DATA === 'true' ? oldSamples : []),...(padang ? padangSamples : [])]
  for (const [index,name,city,district,description,tech,specialty,device,service,price] of samples) {
    const shop = '00000000-0000-4000-8000-00000000000'+index
    const existing = await shops.findOne({ _id:shop })
    if (existing) {
      if (existing.name === name && existing.city === city && existing.demo === undefined) {
        await shops.updateOne({ _id:shop,demo:{ $exists:false } },{ $set:{ demo:true } })
      }
      continue
    }
    const members:Member[] = []
    for (const role of ['manager','technician'] as const) {
      const email = role+index+'@demo.example'
      const display = role === 'manager' ? 'Pengelola '+name : tech
      const user = await users.findOneAndUpdate({ email },{
        $setOnInsert:{ _id:randomUUID(),name:display,password,platform_admin:false },
      },{ upsert:true,returnDocument:'after' })
      members.push({ user_id:user!._id,name:display,role,...(role === 'technician' ? { specialty } : {}) })
    }
    await shops.updateOne({ _id:shop },{ $setOnInsert:{
      name,city,district,description,dropoff_address:'Lokasi serah terima contoh, '+district+', '+city,
      verified:true,created_at:new Date(),members,demo:true,
      ...(points[index] ? { location:{ type:'Point' as const,coordinates:points[index] } } : {}),
      services:[{ id:'10000000-0000-4000-8000-00000000000'+index,device,name:service,starting_price:price,warranty_days:30 }],
    } },{ upsert:true })
  }
  const productShop = '00000000-0000-4000-8000-000000000005'
  if ((padang || productSeedOnly) && await shops.findOne({ _id:productShop,demo:true })) {
    await products.updateOne({ _id:'20000000-0000-4000-8000-000000000005' },{ $setOnInsert:{
      shop_id:productShop,name:'Laptop kerja 14 inci',category:'laptop',condition:'used',
      description:'Unit demo untuk simulasi katalog laptop bekas.',condition_notes:'Ilustrasi kondisi: terdapat goresan ringan. Kelengkapan contoh: unit dan adaptor.',inspection_notes:'Ilustrasi pemeriksaan: layar, keyboard, kamera, speaker, dan pengisian daya berfungsi.',
      price:2800000,stock:1,warranty_days:30,photo_url:'/demo-used-laptop.jpg',created_at:new Date(),published:true,
    } },{ upsert:true })
    const demoProducts = [
      { id:'006',name:'Ponsel Android 128 GB',category:'phone',condition:'used',description:'Ponsel bekas untuk kebutuhan harian, sudah direset dan siap digunakan.',condition_notes:'Ilustrasi kondisi: bodi memiliki bekas pemakaian ringan. Kelengkapan: unit dan kabel USB.',inspection_notes:'Ilustrasi pemeriksaan: layar sentuh, kamera, speaker, mikrofon, Wi-Fi, dan pengisian daya berfungsi.',price:1850000,stock:1,warranty_days:14,photo_url:'https://images.unsplash.com/photo-1706509511714-2a1e0f74321e?auto=format&fit=crop&w=900&q=82' },
      { id:'007',name:'Laptop belajar 14 inci',category:'laptop',condition:'new',description:'Laptop baru untuk belajar dan pekerjaan ringan dengan garansi toko.',condition_notes:null,inspection_notes:null,price:6250000,stock:4,warranty_days:90,photo_url:'https://images.unsplash.com/photo-1657524433787-a30cefc92661?auto=format&fit=crop&w=900&q=82' },
      { id:'008',name:'Charger USB-C 20 W',category:'phone_accessory',condition:'new',description:'Adaptor pengisian daya USB-C ringkas untuk ponsel dan aksesori kompatibel.',condition_notes:null,inspection_notes:null,price:125000,stock:18,warranty_days:30,photo_url:'https://images.unsplash.com/photo-1770418000074-fa16c0a53e82?auto=format&fit=crop&w=900&q=82' },
      { id:'009',name:'Kabel USB-C 1 meter',category:'phone_accessory',condition:'new',description:'Kabel USB-C untuk pengisian daya dan transfer data perangkat yang mendukung.',condition_notes:null,inspection_notes:null,price:45000,stock:25,warranty_days:7,photo_url:'https://storage.googleapis.com/bpv/charger-usb-cable-type-c-white-isolated-background.exact1600w.jpg' },
      { id:'010',name:'Mouse nirkabel',category:'laptop_accessory',condition:'new',description:'Mouse nirkabel ergonomis untuk menunjang aktivitas belajar dan kerja.',condition_notes:null,inspection_notes:null,price:95000,stock:12,warranty_days:30,photo_url:'https://images.unsplash.com/photo-1674308423121-78686bb1d648?auto=format&fit=crop&w=900&q=82' },
      { id:'011',name:'Adaptor laptop USB-C 65 W',category:'laptop_accessory',condition:'new',description:'Adaptor USB-C 65 W untuk laptop yang mendukung pengisian melalui USB-C.',condition_notes:null,inspection_notes:null,price:325000,stock:8,warranty_days:30,photo_url:'https://images.unsplash.com/photo-1721036469059-ab07e6bb6508?auto=format&fit=crop&w=900&q=82' },
      { id:'012',name:'Ponsel Android 256 GB',category:'phone',condition:'new',description:'Ponsel baru dengan ruang penyimpanan lega untuk aplikasi dan foto.',condition_notes:null,inspection_notes:null,price:3890000,stock:6,warranty_days:180,photo_url:'https://images.unsplash.com/photo-1722888595094-5599caca7242?auto=format&fit=crop&w=900&q=82' },
      { id:'013',name:'Keyboard laptop bekas',category:'laptop_accessory',condition:'used',description:'Keyboard eksternal bekas yang telah dibersihkan dan siap dipakai.',condition_notes:'Ilustrasi kondisi: terdapat goresan kecil pada sisi casing. Kelengkapan: unit dan kabel.',inspection_notes:'Ilustrasi pemeriksaan: seluruh tombol, koneksi USB, dan indikator berfungsi.',price:85000,stock:1,warranty_days:7,photo_url:'https://images.unsplash.com/photo-1721036469059-ab07e6bb6508?auto=format&fit=crop&w=900&q=82' },
      { id:'014',name:'Headset kabel 3,5 mm',category:'phone_accessory',condition:'new',description:'Headset kabel dengan mikrofon untuk panggilan dan mendengarkan audio.',condition_notes:null,inspection_notes:null,price:79000,stock:15,warranty_days:7,photo_url:'https://images.unsplash.com/photo-1599669454515-1b2e0173f302?auto=format&fit=crop&w=900&q=82' },
      { id:'015',name:'Laptop kerja 15 inci',category:'laptop',condition:'new',description:'Laptop baru untuk multitugas harian dengan layar lega dan garansi toko.',condition_notes:null,inspection_notes:null,price:8750000,stock:3,warranty_days:180,photo_url:'https://images.unsplash.com/photo-1476365518243-f738bf58443d?auto=format&fit=crop&w=900&q=82' },
    ] as const
    for (const item of demoProducts) {
      await products.updateOne({ _id:'20000000-0000-4000-8000-'+item.id.padStart(12,'0') },{ $setOnInsert:{
        shop_id:productShop,name:item.name,category:item.category,condition:item.condition,description:item.description,
        condition_notes:item.condition_notes,inspection_notes:item.inspection_notes,price:item.price,stock:item.stock,
        warranty_days:item.warranty_days,photo_url:item.photo_url,
        created_at:new Date(),published:true,
      },$set:{ photo_url:item.photo_url } },{ upsert:true })
    }
  }
}
setup().then(() => console.log('MongoDB siap.')).catch(error => { console.error(error?.message); process.exitCode=1 }).finally(() => client.close())

