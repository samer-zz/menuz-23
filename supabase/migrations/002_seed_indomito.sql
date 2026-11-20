-- Idempotent Seed Data for First Tenant: INDOMITO (إندوميتو)
do $$
declare
  v_tenant_id uuid;
  v_cat_sandwich uuid;
  v_cat_fries uuid;
  v_cat_indomito uuid;
  v_cat_karkadeh uuid;
begin
  -- 1. Upsert INDOMITO tenant
  insert into public.tenants (
    slug, name_ar, name_en, story, description, address,
    phone, whatsapp, instagram, has_delivery, delivery_note,
    logo_url, primary_color, accent_color, currency, is_active
  )
  values (
    'indomito',
    'إندوميتو',
    'INDOMITO',
    'وجبات سريعة بطابع فريد في قلب صنعاء — سندوتشات مقرمشة، شبس ذهبي ساخن، أطباق إندوميتو المميزة، وكركديه بارد منعش يُحضّر يومياً.',
    'سندوتشات، شبس، أطباق إندوميتو، ومشروب الكركديه المنعش — صنعاء.',
    'صنعاء - شارع التحرير - أمام المتحف الحربي',
    '785184242',
    '967785184242',
    'indo.mito',
    true,
    'خدمة التوصيل متوفرة داخل صنعاء',
    '/branding/indomito_logo.png',
    '#0B2D5B',
    '#FF7A00',
    'ر.ي',
    true
  )
  on conflict (slug) do update set
    name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    address = excluded.address,
    phone = excluded.phone,
    whatsapp = excluded.whatsapp,
    instagram = excluded.instagram,
    has_delivery = excluded.has_delivery,
    logo_url = coalesce(public.tenants.logo_url, excluded.logo_url)
  returning id into v_tenant_id;

  -- Only seed categories & items if tenant currently has 0 categories
  if not exists (select 1 from public.categories where tenant_id = v_tenant_id) then
    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_tenant_id, 'سندوتش', 'سندوتشات طازجة محضّرة عند الطلب', 1, true)
    returning id into v_cat_sandwich;

    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_tenant_id, 'شبس', 'بطاطس مقلية ذهبية ومقرمشة', 2, true)
    returning id into v_cat_fries;

    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_tenant_id, 'اندوميتو', 'أطباق إندوميتو الخاصة بنكهاتنا المميزة', 3, true)
    returning id into v_cat_indomito;

    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_tenant_id, 'كركديه', 'مشروب كركديه بارد ومنعش', 4, true)
    returning id into v_cat_karkadeh;

    -- Menu Items: سندوتش
    insert into public.menu_items (tenant_id, category_id, name, ingredients, price, is_available, is_featured, badges, sort_order) values
    (v_tenant_id, v_cat_sandwich, 'سندوتش شبس', 'خبز طازج، شبس مقرمش، صوص خاص', 100, true, false, '{}', 1),
    (v_tenant_id, v_cat_sandwich, 'سندوتش شبس جبن', 'خبز طازج، شبس مقرمش، جبن ذائب', 150, true, true, '{"best_seller"}', 2),
    (v_tenant_id, v_cat_sandwich, 'سندوتش دبل خبز جبن', 'خبز مضاعف، شبس مقرمش، جبن غني', 200, true, false, '{"new"}', 3);

    -- Menu Items: شبس
    insert into public.menu_items (tenant_id, category_id, name, ingredients, price, is_available, is_featured, badges, sort_order) values
    (v_tenant_id, v_cat_fries, 'شبس (صغير)', 'بطاطس مقرمشة مع تتبيلة خاصة', 200, true, false, '{}', 1),
    (v_tenant_id, v_cat_fries, 'شبس (وسط)', 'بطاطس مقرمشة حجم وسط مع صوص', 300, true, false, '{}', 2),
    (v_tenant_id, v_cat_fries, 'شبس (كبير)', 'بطاطس مقرمشة حجم كبير عائلي', 500, true, false, '{}', 3),
    (v_tenant_id, v_cat_fries, 'شبس جبن', 'بطاطس مقرمشة مغطاة بصوص الجبن الساخن', 600, true, true, '{"best_seller"}', 4);

    -- Menu Items: اندوميتو
    insert into public.menu_items (tenant_id, category_id, name, ingredients, price, is_available, is_featured, badges, sort_order) values
    (v_tenant_id, v_cat_indomito, 'اندوميتو (صغير)', 'نودلز ساخنة بتتبيلة إندوميتو الخاصة', 300, true, false, '{}', 1),
    (v_tenant_id, v_cat_indomito, 'اندوميتو (وسط)', 'نودلز ساخنة حجم وسط مع التوابل المميزة', 500, true, false, '{}', 2),
    (v_tenant_id, v_cat_indomito, 'اندوميتو جبن', 'نودلز ساخنة مع الجبن الذائب والبهارات', 600, true, true, '{"best_seller"}', 3),
    (v_tenant_id, v_cat_indomito, 'اندوميتو (كبير)', 'حجم كبير مشبع بنكهة إندوميتو الأصلية', 1000, true, true, '{"new"}', 4);

    -- Menu Items: كركديه
    insert into public.menu_items (tenant_id, category_id, name, ingredients, price, is_available, is_featured, badges, sort_order) values
    (v_tenant_id, v_cat_karkadeh, 'كركديه (وسط)', 'كركديه طبيعي بارد ومنعش', 150, true, false, '{}', 1),
    (v_tenant_id, v_cat_karkadeh, 'كركديه (كبير)', 'كركديه طبيعي بارد حجم كبير', 250, true, true, '{}', 2);
  end if;
end $$;
