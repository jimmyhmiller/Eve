//---------------------------------------------------------------------
// String providers
//---------------------------------------------------------------------

import {Constraint} from "../join";
import * as providers from "./index";


const camelCased = s => s.replace(/-([a-z])/g, g => g[1].toUpperCase());

const argsToAttributeMapping = (args, attributeMapping) => {
  if (!attributeMapping) {
    return args;
  }
  const obj = {}
  Object.keys(attributeMapping).forEach(am => {
    obj[camelCased(am)] = args[attributeMapping[am]];
  })
  return obj
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const makeConstraint = f => class Test extends Constraint {
  static AttributeMapping = f.prototype.AttributeMapping;

  getProposal(tripleIndex, proposed, prefix) {
    const proposal = this.proposalObject;
    const { args } = this.resolve(prefix);
    const objArgs = argsToAttributeMapping(args, f.prototype.AttributeMapping);
    proposal.providing = proposed;
    const result = f(objArgs);
    proposal.cardinality = result[0] === false ? 0 : f(objArgs).length;
    return proposal;
  }

  test(prefix) {
    const {args, returns} = this.resolve(prefix);
    const objArgs = argsToAttributeMapping(args, f.prototype.AttributeMapping);
    return arraysEqual(f(objArgs), returns);
  }

  resolveProposal(proposal, prefix) {
    const {args} = this.resolve(prefix);
    const objArgs = argsToAttributeMapping(args, f.prototype.AttributeMapping);
    return f(objArgs);
  }
}

const concat = (args) => [args.join("")];
const Concat = makeConstraint(concat);


const replace = ({ text, subtext, with: withText }) => [text.replace(subtext, withText)];
replace.prototype.AttributeMapping = {
  "text": 0,
  "subtext": 1,
  "with": 2,
}
const Replace = makeConstraint(replace);


const length = ({ text }) => [text.length]
length.prototype.AttributeMapping = {
    "text": 0,
 }
const Length = makeConstraint(length);

const charAt = ({ text, index }) => [text[index]];
charAt.prototype.AttributeMapping = {
  text: 0,
  index: 1,
}
const CharAt = makeConstraint(charAt);

const find = ({ text, subtext, caseSensitive }) => {
  text = !caseSensitive ? text.toLowerCase() : text;
  subtext = !caseSensitive ? subtext.toLowerCase() : subtext;
  let temp = [];
  for (let i = 0; i < text.length; i ++) {
    if (text.substring(i, i + subtext.length) === subtext) {
       temp.push(i);
    }
  }
  return temp;
}

find.prototype.AttributeMapping = {
  "text": 0,
  "subtext": 1,
  "case-sensitive": 2,
}

const Find = makeConstraint(find);

const substring = ({ text, from, to }) => [text.substring(from, to)];
substring.prototype.AttributeMapping = {
  "text": 0,
  "from": 1,
  "to": 2,
}
const Substring = makeConstraint(substring); 

const lower = ({ text }) => [text.toLowerCase()];
lower.prototype.AttributeMapping = {
  "text": 0,
}
const Lower = makeConstraint(lower);

const upper = ({ text }) => [text.toUpperCase()];
upper.prototype.AttributeMapping = {
  "text": 0,
}
const Upper = makeConstraint(upper);

const startsWith = ({ text, with: withText }) => [text.startsWith(withText)];
startsWith.prototype.AttributeMapping = {
  "text": 0,
  "with": 1,
}
const StartsWith = makeConstraint(startsWith);


const trim = ({ text, with: withText }) => [text.trim()];
trim.prototype.AttributeMapping = {
  "text": 0,
}
const Trim = makeConstraint(trim);


class Split extends Constraint {
  static AttributeMapping = {
    "text": 0,
    "by": 1,
  }
  static ReturnMapping = {
    "token": 0,
    "index": 1,
  }

  returnType: "both" | "index" | "token";

  constructor(id: string, args: any[], returns: any[]) {
    super(id, args, returns);
    if(this.returns[1] !== undefined && this.returns[0] !== undefined) {
      this.returnType = "both"
    } else if(this.returns[1] !== undefined) {
      this.returnType = "index";
    } else {
      this.returnType = "token";
    }
  }

  resolveProposal(proposal, prefix) {
    let {returns} = this.resolve(prefix);
    let tokens = proposal.index;
    let results = tokens;
    if(this.returnType === "both") {
      results = [];
      let ix = 1;
      for(let token of tokens) {
        results.push([token, ix]);
        ix++;
      }
    } else if(this.returnType === "index") {
      results = [];
      let ix = 1;
      for(let token of tokens) {
        results.push(ix);
        ix++;
      }
    }
    return results;
  }

  test(prefix) {
    let {args, returns} = this.resolve(prefix);
    // @TODO: this is expensive, we should probably try to cache the split somehow
    return args[0].split(args[1])[returns[1]] === returns[0];
  }

  getProposal(tripleIndex, proposed, prefix) {
    let {args} = this.resolve(prefix);
    let proposal = this.proposalObject;
    if(this.returnType === "both") {
      proposal.providing = [this.returns[0], this.returns[1]];
    } else if(this.returnType == "index") {
      proposal.providing = this.returns[1];
    } else {
      proposal.providing = this.returns[0];
    }
    proposal.index = args[0].split(args[1]);
    proposal.cardinality = proposal.index.length;
    return proposal;
  }
}


class Convert extends Constraint {
  static AttributeMapping = {
    "value": 0,
    "to": 1,
  }
  static ReturnMapping = {
    "converted": 0,
  }

  resolveProposal(proposal, prefix) {
    let {args, returns} = this.resolve(prefix);
    let from = 0;
    let value = args[0];
    let to = args[1];
    let converted;
    if(to === "number") {
      converted = +value;
      if(isNaN(converted)) throw new Error("Unable to deal with NaN in the proposal stage.");
    } else if(to === "string") {
      converted = ""+value;
    }
    return [converted];
  }

  test(prefix) {
    let {args, returns} = this.resolve(prefix);
    let value = args[0];
    let to = args[1];

    let converted;
    if(to === "number") {
      converted = +value;
      if(isNaN(converted)) return false;
      if(converted === "") return false;
      return
    } else if(to === "string") {
      converted = ""+value;
    } else {
      return false;
    }

    return converted === returns[0];
  }

  // 1 if valid, 0 otherwise
  getProposal(tripleIndex, proposed, prefix) {
    let proposal = this.proposalObject;
    let {args} = this.resolve(prefix);
    let value = args[0];
    let to = args[1];

    proposal.cardinality = 1;
    proposal.providing = proposed;

    if(to === "number") {
      if(isNaN(+value) || value === "") proposal.cardinality = 0;
    } else if(to === "string") {
    } else {
      proposal.cardinality = 0;
    }

    return proposal;
  }
}

providers.provide("trim", Trim);
providers.provide("starts-with", StartsWith);
providers.provide("upper", Upper);
providers.provide("lower", Lower);
providers.provide("find", Find);
providers.provide("char-at", CharAt);
providers.provide("replace", Replace);
providers.provide("length", Length);
providers.provide("concat", Concat);
providers.provide("split", Split);
providers.provide("substring", Substring);
providers.provide("convert", Convert);
