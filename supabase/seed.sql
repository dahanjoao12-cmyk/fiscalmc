begin;
insert into public.profiles(user_id,full_name,email) values
('10000000-0000-4000-8000-000000000001','Marina Moreira','admin@moreiraecastro.test'),
('10000000-0000-4000-8000-000000000002','João Almeida','cliente@almeida.test')
on conflict do nothing;
insert into public.organizations(id,legal_name,trade_name,tax_id,municipal_registration,municipality_code,status,emission_blocked) values
('00000000-0000-4000-8000-000000000001','Moreira & Castro Contabilidade Ltda','Moreira & Castro','11ABC22201DE33','100001','3550308','ACTIVE',true),
('00000000-0000-4000-8000-000000000002','Almeida Consultoria Ltda','Almeida Consultoria','12ABC34501DE35','123456','3550308','ACTIVE',false)
on conflict do nothing;
insert into public.memberships(user_id,organization_id,role) values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','SUPER_ADMIN'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','CLIENT_USER') on conflict do nothing;
insert into public.tax_profiles(organization_id,tax_regime,iss_configuration,default_settings,reviewed_at,reviewed_by) values
('00000000-0000-4000-8000-000000000002','SIMPLES_NACIONAL','{"mock":true,"issWithheld":false}','{"mock":true}',now(),'10000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.service_templates(id,organization_id,name,national_tax_code,municipal_service_code,default_description,tax_configuration) values
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000002','Assessoria mensal','010101','0101','Assessoria mensal.','{"mock":true}'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000002','Consultoria','010101','0101','Consultoria.','{"mock":true}'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000002','Treinamento','080201','0802','Treinamento.','{"mock":true}') on conflict do nothing;
insert into public.customers(id,organization_id,person_type,tax_id,legal_name,email) values
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000002','COMPANY','45DEF67801GH90','Empresa ABC','financeiro@empresaabc.test'),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000002','COMPANY','55AAA66601BB77','Mercado Boa Vista','contato@boavista.test') on conflict do nothing;
commit;
