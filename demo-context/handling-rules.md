# Synthetic mobile-device handling rules

These rules are designed for a prototype and are not If's internal claims instructions. Public If guidance inspired the terminology and customer journey. A human claims handler remains accountable for every decision and external action.

## G-01 - Decision boundary

The copilot may extract, compare, explain, draft, and recommend. It must never approve or deny coverage, calculate or offer compensation, set a deductible, price the claim, or communicate externally without a handler's action.

## G-02 - Human control

Every customer message, routing change, task creation, or other external action requires handler review. The interface must make the proposed action editable and require explicit approval or confirmation.

## C-01 - Accidental-damage indicator

A reported event may be relevant to Otur accidental-damage handling when it is described as sudden, unforeseen, and caused by an external event. This is an indicator for handler review, not a coverage conclusion.

## C-02 - Basic eligibility checks

Before recommending routine mobile-device handling, verify from available sources:

1. policy active on the incident date;
2. accidental-damage cover listed in the policy snapshot;
3. claimant and policy holder align;
4. device is personal rather than company-owned;
5. incident, item, ownership, and damage are sufficiently described.

Contradictions or material uncertainty must be surfaced rather than resolved by assumption.

## E-01 - Evidence expectations

For a damaged mobile phone, useful evidence includes make, model, purchase date, ownership support, a damage photograph, and a repair estimate. Cite each fact to the claim or evidence register. Do not treat the photograph as proof of facts it cannot establish.

## E-02 - Damage photograph checks

For EVID-01, record exactly two checks:

1. **Damage clearly visible:** confirm only when the submitted image clearly shows the reported physical damage.
2. **Front and rear views supplied:** confirm only when separate usable views show both the front and rear of the device.

A single front-facing photograph leaves the second check not confirmed.

## E-03 - Purchase receipt checks

For EVID-02, record exactly two checks:

1. **Purchase details readable:** confirm when purchaser, device, purchase date, and amount are readable and align with the claim.
2. **Device identifier visible:** confirm only when a serial number or IMEI is readable on the submitted purchase evidence.

A receipt without a serial number or IMEI leaves the second check not confirmed.

## E-04 - Repair estimate checks

For EVID-03, record exactly two checks:

1. **Repair scope and total readable:** confirm when the repairer, proposed work, and total including VAT are present.
2. **Device identifier matched:** confirm only when the estimate includes a serial number or IMEI that can be matched to the claimed device.

An estimate without a serial number or IMEI leaves the second check not confirmed.

## H-01 - Repair-first handling

Public If customer guidance says a damaged mobile should generally be assessed for repair first and asks customers to obtain a repair cost estimate. When the file contains a coherent estimate, the copilot may recommend repair-path review or routing. It must not authorize the repair.

## R-01 - Suggested routing

A complete, coherent accidental mobile-damage case may be suggested for the queue `Home Contents / Mobile Device Review`. Route suggestions require handler confirmation. Ambiguity, sensitive circumstances, fraud indicators, or material contradictions require a human specialist queue.

## Q-01 - Confidence

Confidence expresses the strength and consistency of the available evidence, not the probability that coverage should be approved. Use lower confidence when evidence is missing, sources conflict, or a rule cannot be checked.

## Public guidance used for prototype terminology

- If, "Anmäl stulen eller skadad mobiltelefon": https://www.if.se/privat/vid-skada/saker/stulen-mobil
- If, "Allriskförsäkring - vad är det och hur gäller den?": https://www.if.se/privat/forsakringar/hemforsakring/allriskforsakring
- Accessed for prototype design: 2026-08-03.
