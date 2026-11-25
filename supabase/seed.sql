-- Dados iniciais para testes locais e Preview Branches
insert into public.service_bays (code, name, supported_specialties) values
  ('BOX-01', 'Box 1 · Revisão Rápida', array['revisao', 'freios', 'instalacao']),
  ('BOX-02', 'Box 2 · Mecânica Pesada', array['mecanica', 'freios', 'suspensao']),
  ('BOX-03', 'Box 3 · Elétrica & Injeção', array['eletrica', 'diagnostico', 'instalacao']),
  ('BOX-04', 'Box 4 · Alinhamento 3D', array['geometria', 'suspensao', 'instalacao'])
on conflict (code) do nothing;

insert into public.technicians (full_name, specialties) values
  ('Carlos Henrique', array['revisao', 'freios', 'instalacao']),
  ('Marcos Vinícius', array['mecanica', 'suspensao', 'freios']),
  ('Rafael Almeida', array['eletrica', 'diagnostico', 'instalacao']),
  ('Juliano Costa', array['geometria', 'suspensao', 'revisao']);

insert into public.services (slug, name, description, category, required_specialty, duration_min, buffer_min, base_price_cents) values
  ('revisao-preventiva-10k', 'Revisão Preventiva (10.000 km)', 'Troca de óleo sintético, filtros e checklist de 40 itens.', 'preventive', 'revisao', 90, 15, 42000),
  ('revisao-completa-40k', 'Revisão Completa (40.000 km)', 'Óleo, filtros, velas, fluido de freio e inspeção de correias.', 'preventive', 'revisao', 150, 15, 89000),
  ('diagnostico-injecao', 'Diagnóstico Eletrônico OBD-II', 'Varredura completa de sensores, injeção e módulos.', 'corrective', 'eletrica', 60, 15, 18000),
  ('troca-freios', 'Manutenção de Freios (Discos e Pastilhas)', 'Substituição e sangria do sistema de freios dianteiro/traseiro.', 'corrective', 'freios', 90, 15, 32000),
  ('alinhamento-geometria-3d', 'Alinhamento 3D e Balanceamento', 'Geometria computadorizada nas 4 rodas e balanceamento.', 'preventive', 'geometria', 60, 15, 16000),
  ('instalacao-peca-b2c', 'Instalação de Peça Comprada na Loja', 'Mão de obra dedicada para peça adquirida no e-commerce.', 'installation', 'instalacao', 60, 15, 14000)
on conflict (slug) do nothing;

insert into public.parts_catalog (sku, name, brand, category, description, price_cents, stock_qty, is_installable) values
  ('FR-COB-201', 'Jogo de Pastilhas de Freio Dianteiras Cerâmica', 'Cobreq', 'Freios', 'Baixo ruído e alta durabilidade para uso urbano e rodoviário.', 18990, 24, true),
  ('OL-MOT-5W30', 'Kit Troca de Óleo 5W30 Sintético 4L + Filtro', 'Motul', 'Lubrificantes', 'Especificação API SP / ILSAC GF-6A com filtro original.', 25900, 35, true),
  ('BT-MOU-60AH', 'Bateria Automotiva 60Ah Selada', 'Moura', 'Elétrica', '18 meses de garantia com tecnologia de grade laminada.', 48900, 12, true),
  ('AM-COF-304', 'Par de Amortecedores Dianteiros Turbogás', 'Cofap', 'Suspensão', 'Estabilidade e absorção progressiva para vias irregulares.', 64900, 8, true),
  ('VL-NGK-IRID', 'Jogo de 4 Velas de Ignição Iridium', 'NGK', 'Ignição', 'Melhor eficiência de queima e partidas a frio rápidas.', 22900, 18, true)
on conflict (sku) do nothing;

insert into public.vehicle_compatibility (part_id, brand, model, year_from, year_to)
select id, 'Volkswagen', 'Polo', 2018, 2026 from public.parts_catalog where sku in ('FR-COB-201', 'OL-MOT-5W30', 'BT-MOU-60AH', 'VL-NGK-IRID')
union all
select id, 'Chevrolet', 'Onix', 2020, 2026 from public.parts_catalog where sku in ('FR-COB-201', 'OL-MOT-5W30', 'BT-MOU-60AH', 'AM-COF-304')
union all
select id, 'Toyota', 'Corolla', 2019, 2026 from public.parts_catalog where sku in ('OL-MOT-5W30', 'BT-MOU-60AH', 'VL-NGK-IRID');
