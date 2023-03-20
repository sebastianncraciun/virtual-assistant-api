'use strict';

function dotProduct(a, b) {
    if (a.length !== b.length) {
      throw new Error('Arrays must be of equal length');
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }
    
    return result;
  }

function findBestDotProduct(matrix, matrices) {
    let bestProductValue = -Infinity;
    let bestMatrixIndex  = 0;

    for (let i = 0; i < matrices.length; i++) {
        const productValue = dotProduct(matrix, matrices[i].embedding);
        console.log(productValue,'\n')
        
        if (productValue > bestProductValue) {
        bestProductValue = productValue;
        bestMatrixIndex = matrices[i].index
        }
    }
    return { bestProductValue, bestMatrixIndex };
}

function validateDynamicScreenActions(input) {
  if (!Array.isArray(input)) {
    return false;
  }

  if(input.length === 0){
    return false;
  }

  for (let i = 0; i < input.length; i++) {
    const action = input[i];

    if (
      typeof action.dynamicAction !== 'string' ||
      typeof action.actionDescription !== 'string' ||
      action.dynamicAction === '' ||
      action.actionDescription === ''
    ) {
      return false;
    }
  }

  return true;
}

module.exports = {
    dotProduct,
    findBestDotProduct,
    validateDynamicScreenActions
};
