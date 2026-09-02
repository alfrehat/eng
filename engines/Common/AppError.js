/**
 * engines/Common/AppError.js
 * Standardized Enterprise Error Structure
 */

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errorCode = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, errorCode, details);
  }

  static unauthorized(message = 'غير مصرح بالوصول', errorCode = 'UNAUTHORIZED', details = null) {
    return new AppError(message, 401, errorCode, details);
  }

  static forbidden(message = 'لا تملك الصلاحية الكافية لتنفيذ هذه العملية', errorCode = 'FORBIDDEN', details = null) {
    return new AppError(message, 403, errorCode, details);
  }

  static notFound(message = 'المورد المطلوب غير موجود', errorCode = 'NOT_FOUND', details = null) {
    return new AppError(message, 404, errorCode, details);
  }

  static conflict(message = 'تعارض في حالة المورد', errorCode = 'CONFLICT', details = null) {
    return new AppError(message, 409, errorCode, details);
  }

  static unprocessable(message = 'البيانات المدخلة غير صالحة', errorCode = 'UNPROCESSABLE_ENTITY', details = null) {
    return new AppError(message, 422, errorCode, details);
  }

  static internal(message = 'حدث خطأ داخلي في النظام', errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    return new AppError(message, 500, errorCode, details);
  }
}

module.exports = AppError;
