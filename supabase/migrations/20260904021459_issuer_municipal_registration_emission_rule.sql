begin;

-- E0120 from the restricted National NFS-e environment confirms that, for
-- this contributor and municipality, the registered municipal registration
-- must remain in the organization record but must not be serialized in DPS.
with updated as (
  update public.tax_profiles profile
  set dps_configuration = jsonb_set(
    profile.dps_configuration,
    '{technical,issuerMunicipalRegistrationEmission}',
    '{"mode":"OMIT","source":"SEFIN_REJECTION","referenceDps":"4","referenceCode":"E0120","environment":"PRODUCTION_RESTRICTED"}'::jsonb,
    true
  )
  from public.organizations organization
  where profile.organization_id = organization.id
    and organization.tax_id = '40241895000170'
  returning profile.organization_id
)
insert into public.audit_logs (organization_id, actor_type, action, entity, entity_id, safe_metadata)
select organization_id, 'SYSTEM', 'issuer_municipal_registration_emission_configured', 'tax_profile', organization_id::text,
  '{"mode":"OMIT","source":"SEFIN_REJECTION","referenceDps":"4","referenceCode":"E0120","environment":"PRODUCTION_RESTRICTED"}'::jsonb
from updated;

commit;
