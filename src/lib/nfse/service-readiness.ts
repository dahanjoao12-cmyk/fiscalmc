export type ServiceReadinessStatus="DRAFT"|"PENDING_REVIEW"|"REVIEWED"|"INVALID";

export type ServiceReadinessInput={
  active:boolean;
  national_service_code_id:string|null;
  municipal_service_code:string|null;
  municipal_service_mapping_id:string|null;
  dps_municipal_tax_code:string|null;
  dps_municipal_tax_code_source:string|null;
  service_location_municipality_code:string|null;
  reviewed_at:string|null;
};

export function getServiceReadiness(service:ServiceReadinessInput){
  const missing:string[]=[];
  if(!service.national_service_code_id)missing.push("Código nacional");
  if(!service.municipal_service_mapping_id||!service.municipal_service_code)missing.push("De/para municipal");
  if(!service.dps_municipal_tax_code)missing.push("Código DPS municipal");
  if(service.dps_municipal_tax_code&&!service.dps_municipal_tax_code_source)missing.push("Fonte do código DPS municipal");
  if(!service.service_location_municipality_code)missing.push("Município de prestação");
  const status:ServiceReadinessStatus=missing.length?(missing.length>=3&&!service.reviewed_at?"DRAFT":"PENDING_REVIEW"):service.reviewed_at?"REVIEWED":"PENDING_REVIEW";
  return {status,missing,ready:service.active&&status==="REVIEWED"};
}
