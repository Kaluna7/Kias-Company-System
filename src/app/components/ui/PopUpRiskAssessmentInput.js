// FINANCE INPUT POP UP

import React from "react";
import { ListAssessmentForm } from "../../data/Data";
import { GenericInputModal } from "./GenericInput";
import { LABEL_TO_KEY, NUMERIC_FIELDS,TEXTAREA_LABELS } from "../../data/Data";

// FINANCE INPUT POP UP

import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
export function NewFinanceInput({onClose}){

  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useFinanceStore.getState().createFinance}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
);
}


// ACCOUNTING INPUT POP UP

import { useAccountingStore } from "@/app/stores/RiskAssessement/accountingStore";

export function NewAccountingInput({ onClose }) {
  return (
  <GenericInputModal
  onClose={onClose}
  createItem={useAccountingStore.getState().createAccounting}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// HRD INPUT POP UP

import { useHrdStore } from "@/app/stores/RiskAssessement/hrdStore";

export function NewHrdInput({ onClose }) {

  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useHrdStore.getState().createHrd}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// GENERAL AFFAIR POP UP

import { useGeneralAffairStore } from "@/app/stores/RiskAssessement/gaStore";

export function NewGeneralAffairInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useGeneralAffairStore.getState().createGeneralAffair}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// STORE DESIGN & PLANNING POP UP


import { useStorePlanningStore } from "@/app/stores/RiskAssessement/sdpStore";

export function NewSDPInput({ onClose }) {
  
  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useStorePlanningStore.getState().createStorePlanning}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// TAX POP UP

import { useTaxStore } from "@/app/stores/RiskAssessement/taxStore";

export function NewTaxInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useTaxStore.getState().createTax}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// LOSS & PREVENTION POP UP

import { useLossPreventionStore } from "@/app/stores/RiskAssessement/lpStore";

export function NewLpInput({ onClose }) {
 
  return (
     <GenericInputModal
  onClose={onClose}
  createItem={useLossPreventionStore.getState().createLossPrevention}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// MIS POP UP

import { useMisStore } from "@/app/stores/RiskAssessement/misStore";

export function NewMisInput({ onClose }) {
 
  return (
     <GenericInputModal
  onClose={onClose}
  createItem={useMisStore.getState().createMis}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// MERCHANDISE POP UP

import { useMerchandiseStore } from "@/app/stores/RiskAssessement/merchStore";

export function NewMerchandiseInput({ onClose }) {

  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useMerchandiseStore.getState().createMerchandise}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// OPERATIONAL POP UP

import { useOperationalStore } from "@/app/stores/RiskAssessement/opsStore";

export function NewOperationalInput({ onClose }) {
  
  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useOperationalStore.getState().createOperational}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// WAREHOUSE POP UP

import { useWarehouseStore } from "@/app/stores/RiskAssessement/whsStore";

export function NewWarehouseInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useWarehouseStore.getState().createWarehouse}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}
